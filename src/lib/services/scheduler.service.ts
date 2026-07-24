/**
 * Scheduled job orchestrator.
 *
 * Called every 5 minutes by the Railway cron service via /api/cron/run-jobs.
 *
 * IDEMPOTENCY CONTRACT: Every handler called from runScheduledJobs() MUST be
 * safe to run concurrently and repeatedly. Cron ticks can overlap (previous
 * run still in-flight when next tick fires) and Railway may retry on timeout.
 * Handlers must claim work atomically (e.g. updateMany with a status guard)
 * before acting, so that two overlapping runs never process the same record.
 */

export interface HandlerResult {
  processed: number;
}

export interface SchedulerSummary {
  timestamp: string;
  cascadeWindows: HandlerResult;
  strandedPayments: HandlerResult;
  rescueTimeouts: HandlerResult;
  releases: HandlerResult;
  exhaustedRefunds: HandlerResult;
  backgroundJobs: HandlerResult;
  abandonedBookings: HandlerResult;
  compliance: HandlerResult;
  stuckJobs: HandlerResult;
  completedAtBackfill: HandlerResult;
  catchmentHeal: HandlerResult;
}

import { processNextBatch } from '@/lib/infrastructure/job-processor';
import stripe from '@/lib/stripe';

import {
  processExpiredCascadeWindows as cascadeHandler,
  processExhaustedRefunds as exhaustedRefundHandler,
} from './cascade.service';
import { ComplianceSchedulerService } from './compliance-scheduler.service';
import { releaseBookingFunds } from './transfer.service';

const ABANDONED_BATCH_LIMIT = 50;
const ABANDONED_AGE_MS = 60 * 60 * 1000; // 60 minutes

// Reaper for bookings that were created but never paid (customer abandoned at the
// card step, or no webhook ever arrived). Without this they sit as PENDING rows
// that hold the cleaner's slot forever and clutter their job list.
//
// AMENDMENT 1 (James-signed): cancel the PaymentIntent at Stripe FIRST. If cancel
// SUCCEEDS, the payment can no longer complete → safe to cancel the booking. If
// cancel ERRORS because the intent already succeeded, STAND DOWN — the succeeded
// webhook owns that booking. Either way the outcome is coherent: payment-and-
// booking, or neither, never one without the other. The final booking update is
// atomically guarded on status='PENDING' so it can't clobber a booking the
// webhook just took live.
async function processAbandonedBookings(): Promise<HandlerResult> {
  const { prisma } = await import('@/lib/db/prisma');
  const cutoff = new Date(Date.now() - ABANDONED_AGE_MS);

  // H53: reap UNPAID bookings in any pre-work status. PENDING is the normal
  // abandoned-at-checkout shape; AWAITING_CLEANER catches the legacy phantom —
  // a booking that was offered while still unpaid (before offer entry was
  // gated on the payment webhook). Both are retracted here. The outer
  // paymentStatus filter guarantees these are genuinely unpaid, and cancelling
  // the PI first (Amendment 1) stands down the instant Stripe says it's paid —
  // so a truly-paid row can never be clobbered. Retraction is a plain CANCELLED
  // write, NOT a decline: no decline penalty is recorded against any cleaner
  // who was phantom-offered, and the read-guard already hid it from them.
  const REAPABLE_STATUSES = ['PENDING', 'AWAITING_CLEANER'] as const;
  const stale = await prisma.booking.findMany({
    where: {
      status: { in: [...REAPABLE_STATUSES] },
      paymentStatus: { in: ['PENDING', 'FAILED', 'CANCELED', 'REQUIRES_ACTION'] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, stripePaymentIntentId: true },
    take: ABANDONED_BATCH_LIMIT,
  });

  let processed = 0;

  for (const booking of stale) {
    // 1. Cancel the PaymentIntent at Stripe first.
    if (booking.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(booking.stripePaymentIntentId);
      } catch {
        // Intent already succeeded (or otherwise uncancelable) — stand down and
        // let the succeeded webhook complete the booking.
        continue;
      }
    }

    // 2. PI is cancelled (or there was none) — cancel the booking, guarded on
    //    the same unpaid pre-work statuses so we never cancel a booking the
    //    webhook just took live (which would also have flipped paymentStatus to
    //    SUCCEEDED, failing the guard).
    const result = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: { in: [...REAPABLE_STATUSES] },
        paymentStatus: { in: ['PENDING', 'FAILED', 'CANCELED', 'REQUIRES_ACTION'] },
      },
      // F6a: never-paid rows get their own terminal species — ABANDONED, not
      // CANCELLED. Nobody cancelled anything; checkout was simply never
      // finished. Keeps cancellation stats and cancelled lists honest.
      data: { status: 'ABANDONED', paymentStatus: 'CANCELED' },
    });
    if (result.count > 0) processed++;
  }

  return { processed };
}

async function processExpiredCascadeWindows(): Promise<HandlerResult> {
  return cascadeHandler();
}

const RELEASE_BATCH_LIMIT = 50;

async function processDueReleases(): Promise<HandlerResult> {
  const { prisma } = await import('@/lib/db/prisma');
  const now = new Date();

  const due = await prisma.booking.findMany({
    where: {
      releaseDueAt: { lte: now },
      transferStatus: 'PENDING',
    },
    select: { id: true },
    take: RELEASE_BATCH_LIMIT,
  });

  let processed = 0;

  for (const booking of due) {
    try {
      const result = await releaseBookingFunds(booking.id, { trigger: 'SCHEDULER' });
      if (result.status === 'RELEASED' || result.status === 'ALREADY_RELEASED') {
        processed++;
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[Release] Booking ${booking.id}: ${result.status} — ${result.reason}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Release] Error processing booking ${booking.id}:`, error);
    }
  }

  if (due.length === RELEASE_BATCH_LIMIT) {
    // eslint-disable-next-line no-console
    console.warn(`[Release] Hit batch limit (${RELEASE_BATCH_LIMIT}) — more bookings next tick`);
  }

  return { processed };
}

async function processExhaustedRefunds(): Promise<HandlerResult> {
  return exhaustedRefundHandler();
}

const JOB_BATCH_LIMIT = 50;

// Drain the generic BackgroundJob queue (XERO_PUSH and every other enqueued
// job type) via the registered handlers. Previously nothing called
// processNextBatch, so the whole queue dead-lettered; wiring it here is the
// single drain point. Atomic-claim inside processNextBatch keeps overlapping
// cron ticks from double-processing.
async function processBackgroundJobs(): Promise<HandlerResult> {
  const processed = await processNextBatch(JOB_BATCH_LIMIT);
  return { processed };
}

const COMPLIANCE_MARKER_KEY = 'last_compliance_run_date';

// The compliance / retention batch (DBS + RTW destruction, RTW expiry alerts
// and auto-suspension, analytics anonymisation, DPA expiry) is daily-cadence,
// but this orchestrator fires every 5 minutes. Day-guard it with an atomic
// compare-and-swap on a PlatformConfig marker: flip the marker to today's UTC
// date only if it isn't already today. Postgres re-evaluates the updateMany
// WHERE against the committed row under its lock, so of two overlapping cron
// ticks exactly one gets count===1 and runs the batch — no double-run.
//
// The marker row is seeded (create-only) by seed-reference-data.ts, which runs
// before the server starts, so it always exists when a cron tick fires. If it
// were somehow absent the CAS matches nothing and the batch simply skips (fails
// safe) until the next deploy re-seeds it.
async function processComplianceJobsDaily(): Promise<HandlerResult> {
  const { prisma } = await import('@/lib/db/prisma');
  const today = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd

  const claim = await prisma.platformConfig.updateMany({
    where: { key: COMPLIANCE_MARKER_KEY, value: { not: today } },
    data: { value: today },
  });

  if (claim.count === 0) {
    return { processed: 0 }; // already ran today (or marker missing → safe skip)
  }

  const results = await ComplianceSchedulerService.runAllJobs();
  return { processed: results.length };
}

// M4 safety net: stranded PAID bookings (webhook received but crashed before
// completing). Same processing path as the webhook; loud [PAYMENT-SWEEP] log
// per catch. Never throws — a sweep failure must not block the other jobs.
async function processStrandedPayments(): Promise<HandlerResult> {
  try {
    const { sweepStrandedPayments } = await import('./payment-success.service');
    const result = await sweepStrandedPayments();
    return { processed: result.processed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PAYMENT-SWEEP] sweep failed:', err);
    return { processed: 0 };
  }
}

// M3 rescue: auto-refund cleaner-cancelled bookings whose choice window closed.
async function processRescueTimeouts(): Promise<HandlerResult> {
  try {
    const { sweepRescueTimeouts } = await import('./rescue.service');
    const r = await sweepRescueTimeouts();
    return { processed: r.refunded };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[RESCUE-SWEEP] sweep failed:', err);
    return { processed: 0 };
  }
}

// H81: self-healing completedAt backfill. The H79 earnings surfaces key on
// completedAt, but two historical paths (admin status override, dispute
// resolution from IN_PROGRESS) landed bookings in COMPLETED with a null
// completedAt — invisible on every earnings surface while still counting as
// completed. Those write paths are fixed; this sweep repairs the existing
// rows with the best available timestamp, in fallback order:
//   completionConfirmedAt (customer confirmed — closest to the real moment)
//   ?? releaseDueAt        (set at completion + hold; same day)
//   ?? updatedAt           (last write — the honest floor)
// Idempotent and convergent: once no null-completedAt completed rows remain
// it processes 0 forever. New nulls can no longer be created.
async function processCompletedAtBackfill(): Promise<HandlerResult> {
  const { prisma } = await import('@/lib/db/prisma');
  try {
    const rows = await prisma.booking.findMany({
      where: { status: { in: ['COMPLETED', 'REVIEWED'] }, completedAt: null },
      select: { id: true, completionConfirmedAt: true, releaseDueAt: true, updatedAt: true },
      take: 50,
    });
    for (const b of rows) {
      const stamp = b.completionConfirmedAt ?? b.releaseDueAt ?? b.updatedAt;
      await prisma.booking.updateMany({
        where: { id: b.id, completedAt: null },
        data: { completedAt: stamp },
      });
      // eslint-disable-next-line no-console
      console.log(`[CompletedAtBackfill] ${b.id} stamped ${stamp.toISOString()}`);
    }
    return { processed: rows.length };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[CompletedAtBackfill] sweep failed:', err);
    return { processed: 0 };
  }
}

// H89 (James-promoted): self-healing catchment sweep. Live cleaners whose one
// fire-and-forget generation attempt failed (ORS outage, geocode blip) used to
// stay on the crow-flies fallback until a profile edit or a manual batch run.
// This sweep regenerates them on the existing tick and, like the completedAt
// sweep, converges to zero: once every live cleaner has a polygon it selects
// nothing forever.
//
// ORS free-tier discipline (~500 calls/day, ~20/min): at most 2 attempts per
// 5-minute tick (well under the rate limit), a 100/day cap so signups and the
// batch script keep most of the budget, and a 24h per-cleaner cooldown so a
// permanently-failing cleaner (unresolvable postcode, dead ORS account) costs
// one attempt per day, not one per tick. Cap and cooldown are in-memory —
// a deploy restart resets them, which only ever errs toward retrying sooner.
const CATCHMENT_HEAL_BATCH = 2;
const CATCHMENT_HEAL_DAILY_CAP = 100;
const CATCHMENT_HEAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
let catchmentHealDay = '';
let catchmentHealMintedToday = 0;
const catchmentHealLastAttempt = new Map<string, number>();

async function processCatchmentHeal(): Promise<HandlerResult> {
  // Feature dormant without the key — silent early-out (the boot log already
  // names the unset variable once; naming it every 5 minutes is noise).
  if (!process.env.ORS_API_KEY) return { processed: 0 };

  try {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== catchmentHealDay) {
      catchmentHealDay = today;
      catchmentHealMintedToday = 0;
    }
    if (catchmentHealMintedToday >= CATCHMENT_HEAL_DAILY_CAP) return { processed: 0 };

    const { prisma } = await import('@/lib/db/prisma');
    const { Prisma } = await import('@prisma/client');
    const { eligibleCleanerWhere } = await import('./area-search.service');
    const candidates = await prisma.cleanerProfile.findMany({
      // AnyNull: a missing polygon is a DB NULL (never written) — AnyNull also
      // catches a JSON-null literal so neither shape can hide from the sweep.
      where: { ...eligibleCleanerWhere(new Date()), catchmentPolygon: { equals: Prisma.AnyNull } },
      select: { userId: true, homePostcode: true, postcode: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const now = Date.now();
    const due = candidates
      .filter((c) => {
        const last = catchmentHealLastAttempt.get(c.userId);
        return last === undefined || now - last > CATCHMENT_HEAL_COOLDOWN_MS;
      })
      .slice(0, CATCHMENT_HEAL_BATCH);

    let processed = 0;
    const { generateCatchmentForCleaner } = await import('./catchment-generation.service');
    for (const c of due) {
      catchmentHealLastAttempt.set(c.userId, now);
      catchmentHealMintedToday++;
      const result = await generateCatchmentForCleaner(c.userId);
      if (result.status === 'generated') {
        processed++;
        // eslint-disable-next-line no-console
        console.log(
          `[CatchmentHeal] minted polygon for ${c.userId} (${c.homePostcode ?? c.postcode ?? 'no postcode'})`
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[CatchmentHeal] ${result.status} for ${c.userId}: ${result.reason} — next attempt after 24h cooldown`
        );
      }
    }
    return { processed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[CatchmentHeal] sweep failed:', err);
    return { processed: 0 };
  }
}

// Stuck-money reaper sweep — detection and nudges ONLY; the money buttons are
// admin-pressed (stuck-jobs.service). Failure-isolated like every handler.
async function processStuckJobs(): Promise<HandlerResult> {
  try {
    const { sweepStuckJobs } = await import('./stuck-jobs.service');
    return await sweepStuckJobs();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[StuckJobs] sweep failed:', err);
    return { processed: 0 };
  }
}

export async function runScheduledJobs(): Promise<SchedulerSummary> {
  const cascadeWindows = await processExpiredCascadeWindows();
  const strandedPayments = await processStrandedPayments();
  const rescueTimeouts = await processRescueTimeouts();
  const releases = await processDueReleases();
  const exhaustedRefunds = await processExhaustedRefunds();
  const backgroundJobs = await processBackgroundJobs();
  const abandonedBookings = await processAbandonedBookings();
  const compliance = await processComplianceJobsDaily();
  const stuckJobs = await processStuckJobs();
  const completedAtBackfill = await processCompletedAtBackfill();
  const catchmentHeal = await processCatchmentHeal();

  return {
    timestamp: new Date().toISOString(),
    cascadeWindows,
    strandedPayments,
    rescueTimeouts,
    releases,
    exhaustedRefunds,
    backgroundJobs,
    abandonedBookings,
    compliance,
    stuckJobs,
    completedAtBackfill,
    catchmentHeal,
  };
}
