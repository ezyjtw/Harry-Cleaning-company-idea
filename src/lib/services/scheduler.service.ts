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
  releases: HandlerResult;
  exhaustedRefunds: HandlerResult;
  backgroundJobs: HandlerResult;
  abandonedBookings: HandlerResult;
  compliance: HandlerResult;
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

  const stale = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
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
    //    PENDING so we never cancel a booking the webhook just took live.
    const result = await prisma.booking.updateMany({
      where: { id: booking.id, status: 'PENDING' },
      data: { status: 'CANCELLED', paymentStatus: 'CANCELED' },
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
      const result = await releaseBookingFunds(booking.id);
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

export async function runScheduledJobs(): Promise<SchedulerSummary> {
  const cascadeWindows = await processExpiredCascadeWindows();
  const releases = await processDueReleases();
  const exhaustedRefunds = await processExhaustedRefunds();
  const backgroundJobs = await processBackgroundJobs();
  const abandonedBookings = await processAbandonedBookings();
  const compliance = await processComplianceJobsDaily();

  return {
    timestamp: new Date().toISOString(),
    cascadeWindows,
    releases,
    exhaustedRefunds,
    backgroundJobs,
    abandonedBookings,
    compliance,
  };
}
