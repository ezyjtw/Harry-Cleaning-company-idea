import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import {
  sendForceCompleteNotice,
  sendJobHappenedAsk,
  sendRefundConfirmationForBooking,
  sendStuckJobNudge,
} from '@/lib/services/email.service';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';

// ─────────────────────────────────────────────────────────────
// Stuck-money reaper (James-approved spec, knobs ratified):
// a paid job past scheduled end + 48h grace with no completion is an unpaid
// cleaner and a charged customer — money in limbo. This service:
//   • DETECTS  (sweep, scheduler-driven, idempotent) — opens a StuckJobCase
//     and sends nudge #1 to the cleaner (bell + push + email, loud logs).
//   • ESCALATES at end + 72h — nudge #2, harder copy.
//   • ASKS the customer on admin request — tokened one-question yes/no.
//   • RESOLVES only by admin button press after end + 5 days:
//     force-complete (existing completion side-effects; a customer YES
//     fast-tracks the release — their yes IS the dispute window answered) or
//     cancel-refund (the existing refundBooking primitive).
// THE TIMER NEVER MOVES MONEY. No new money primitive is invented.
// ─────────────────────────────────────────────────────────────

export const STUCK_GRACE_MS = 48 * 3600_000; // first nudge: end + 48h
export const STUCK_ESCALATE_MS = 72 * 3600_000; // second nudge: end + 72h
export const STUCK_ADMIN_ACTION_MS = 5 * 24 * 3600_000; // buttons arm: end + 5 days
const SWEEP_BATCH = 50;

// The pre-complete set (mirrors the H75 dashboard warning predicate).
const PRE_COMPLETE = ['CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS'] as const;

/** Scheduled end = booking date 00:00 + startTime + duration hours ("Flexible"
 *  start parses to 0:00 — loud beats silent for money-blocking state). */
export function scheduledEnd(b: { date: Date; startTime: string; duration: unknown }): Date {
  const [h, m] = String(b.startTime || '0:0')
    .split(':')
    .map((n) => Number(n) || 0);
  const end = new Date(b.date.getTime());
  end.setHours(h, m, 0, 0);
  end.setTime(end.getTime() + Number(b.duration) * 3600_000);
  return end;
}

/**
 * Scheduler sweep — idempotent per the scheduler contract: case creation is
 * guarded by the bookingId unique; nudges are claimed with null-guarded
 * updateMany writes so overlapping ticks can't double-send.
 */
export async function sweepStuckJobs(): Promise<{ processed: number }> {
  const now = new Date();
  let processed = 0;

  // 1. Auto-close cases whose booking moved on (completed, cancelled,
  //    disputed…) — the case is bookkeeping, never a lock.
  const openCases = await prisma.stuckJobCase.findMany({
    where: { resolvedAt: null },
    select: { id: true, booking: { select: { status: true } } },
    take: SWEEP_BATCH,
  });
  for (const c of openCases) {
    if (!PRE_COMPLETE.includes(c.booking.status as (typeof PRE_COMPLETE)[number])) {
      await prisma.stuckJobCase.updateMany({
        where: { id: c.id, resolvedAt: null },
        data: { resolvedAt: now, resolvedBy: 'system', resolution: 'self-resolved' },
      });
      processed++;
    }
  }

  // 2. Detect new stuck jobs: paid, pre-complete, end + 48h in the past.
  //    Date-bounded in SQL (whole days), exact end-time check in JS.
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: [...PRE_COMPLETE] },
      paymentStatus: 'SUCCEEDED',
      date: { lt: new Date(now.getTime() - STUCK_GRACE_MS + 24 * 3600_000) },
      stuckJobCase: null,
    },
    select: { id: true, date: true, startTime: true, duration: true },
    take: SWEEP_BATCH,
  });
  for (const b of candidates) {
    const end = scheduledEnd(b);
    if (end.getTime() + STUCK_GRACE_MS > now.getTime()) continue;
    try {
      await prisma.stuckJobCase.create({ data: { bookingId: b.id, scheduledEndAt: end } });
    } catch {
      continue; // unique race with an overlapping tick — theirs won
    }
    processed++;
    // eslint-disable-next-line no-console
    console.log(
      `[StuckJobs] Flagged booking ${b.id} — scheduled end ${end.toISOString()}, no completion`
    );
  }

  // 3. Nudge #1 for flagged cases that haven't had it (claim-first).
  const needNudge1 = await prisma.stuckJobCase.findMany({
    where: { resolvedAt: null, nudge1At: null },
    select: { id: true, bookingId: true },
    take: SWEEP_BATCH,
  });
  for (const c of needNudge1) {
    const claimed = await prisma.stuckJobCase.updateMany({
      where: { id: c.id, nudge1At: null },
      data: { nudge1At: now },
    });
    if (claimed.count === 0) continue;
    await nudgeCleaner(c.bookingId, false);
    processed++;
  }

  // 4. Nudge #2 at end + 72h (claim-first).
  const needNudge2 = await prisma.stuckJobCase.findMany({
    where: {
      resolvedAt: null,
      nudge1At: { not: null },
      nudge2At: null,
      scheduledEndAt: { lt: new Date(now.getTime() - STUCK_ESCALATE_MS) },
    },
    select: { id: true, bookingId: true },
    take: SWEEP_BATCH,
  });
  for (const c of needNudge2) {
    const claimed = await prisma.stuckJobCase.updateMany({
      where: { id: c.id, nudge2At: null },
      data: { nudge2At: now },
    });
    if (claimed.count === 0) continue;
    await nudgeCleaner(c.bookingId, true);
    processed++;
  }

  return { processed };
}

async function nudgeCleaner(bookingId: string, escalated: boolean): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { cleanerId: true, serviceType: true, date: true },
  });
  if (!booking?.cleanerId) return;
  await EnhancedNotificationService.send({
    userId: booking.cleanerId,
    type: 'SYSTEM',
    title: escalated ? 'Your payment is waiting on you' : 'Mark your job complete',
    body: escalated
      ? `Your job on ${booking.date.toLocaleDateString('en-GB')} still isn't marked complete — completing it is what releases your payment.`
      : `Your job on ${booking.date.toLocaleDateString('en-GB')} is past its scheduled end — mark it done to get paid.`,
    data: { bookingId },
    category: 'ESSENTIAL',
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[StuckJobs] Nudge bell/push failed for ${bookingId}:`, e);
  });
  const sent = await sendStuckJobNudge(bookingId, escalated).catch(() => false);
  // eslint-disable-next-line no-console
  console.log(
    `[StuckJobs] Nudge${escalated ? ' (escalated)' : ''} for ${bookingId} — email ${sent ? 'sent' : 'NOT sent'}`
  );
}

/** Admin action: send the tokened "did this clean happen?" question. */
export async function askCustomer(
  caseId: string,
  adminId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const c = await prisma.stuckJobCase.findUnique({
    where: { id: caseId },
    select: { bookingId: true, askToken: true, resolvedAt: true },
  });
  if (!c) return { ok: false, error: 'Case not found.', status: 404 };
  if (c.resolvedAt) return { ok: false, error: 'Case already resolved.', status: 400 };

  const sent = await sendJobHappenedAsk(c.bookingId, c.askToken);
  if (!sent) return { ok: false, error: 'Could not send the question email.', status: 502 };

  await prisma.stuckJobCase.update({
    where: { id: caseId },
    data: { customerAskedAt: new Date() },
  });
  await AuditService.log({
    userId: adminId,
    action: 'STUCK_JOB_CUSTOMER_ASKED',
    entityType: 'Booking',
    entityId: c.bookingId,
  }).catch(() => {});
  return { ok: true };
}

/** Tokened customer answer — the token IS the authorization (H8 matrix). */
export async function recordCustomerAnswer(
  askToken: string,
  answer: 'YES' | 'NO'
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const c = await prisma.stuckJobCase.findUnique({
    where: { askToken },
    select: { id: true, bookingId: true, resolvedAt: true, customerAnswer: true },
  });
  if (!c) return { ok: false, error: 'This link is not valid.', status: 404 };
  if (c.resolvedAt)
    return { ok: false, error: 'This booking has already been resolved.', status: 400 };
  if (c.customerAnswer)
    return { ok: false, error: 'You have already answered — thank you.', status: 400 };

  await prisma.stuckJobCase.update({
    where: { id: c.id },
    data: { customerAnswer: answer, customerAnsweredAt: new Date() },
  });
  await AuditService.log({
    action: 'STUCK_JOB_CUSTOMER_ANSWERED',
    entityType: 'Booking',
    entityId: c.bookingId,
    metadata: { answer },
  }).catch(() => {});
  // eslint-disable-next-line no-console
  console.log(`[StuckJobs] Customer answered ${answer} for booking ${c.bookingId}`);
  return { ok: true };
}

function actionArmed(scheduledEndAt: Date): boolean {
  return Date.now() > scheduledEndAt.getTime() + STUCK_ADMIN_ACTION_MS;
}

/**
 * ADMIN BUTTON (money): force-complete. Reuses the completion door's
 * side-effects — status flip (compare-and-swap on the pre-complete set),
 * completedJobs increment, review request. Release:
 *   • customer answered YES → releaseDueAt = now (their yes IS the dispute
 *     window answered) and completionConfirmedAt = their answer time.
 *   • otherwise → releaseDueAt = now + 24h (one last dispute window; the
 *     customer notice says exactly that).
 */
export async function forceComplete(
  caseId: string,
  adminId: string
): Promise<
  { ok: true; released: 'immediate' | '24h' } | { ok: false; error: string; status: number }
> {
  const c = await prisma.stuckJobCase.findUnique({
    where: { id: caseId },
    include: { booking: { select: { id: true, status: true, cleanerId: true } } },
  });
  if (!c) return { ok: false, error: 'Case not found.', status: 404 };
  if (c.resolvedAt) return { ok: false, error: 'Case already resolved.', status: 400 };
  if (!actionArmed(c.scheduledEndAt)) {
    return {
      ok: false,
      error: 'Too early — admin actions arm 5 days after the scheduled end.',
      status: 400,
    };
  }
  if (c.customerAnswer === 'NO') {
    return {
      ok: false,
      error:
        'The customer says this clean did not happen — force-complete is blocked; use cancel & refund (or resolve the disagreement first).',
      status: 409,
    };
  }

  const confirmedByCustomer = c.customerAnswer === 'YES';
  const now = new Date();
  const flip = await prisma.booking.updateMany({
    where: { id: c.bookingId, status: { in: [...PRE_COMPLETE] } },
    data: {
      status: 'COMPLETED',
      completedAt: now,
      completionConfirmedAt: confirmedByCustomer ? (c.customerAnsweredAt ?? now) : null,
      releaseDueAt: confirmedByCustomer ? now : new Date(now.getTime() + 24 * 3600_000),
    },
  });
  if (flip.count === 0) {
    return {
      ok: false,
      error: 'Booking is no longer in a pre-complete state — refresh.',
      status: 409,
    };
  }

  if (c.booking.cleanerId) {
    await prisma.cleanerProfile
      .updateMany({
        where: { userId: c.booking.cleanerId },
        data: { completedJobs: { increment: 1 } },
      })
      .catch(() => {});
  }
  await prisma.stuckJobCase.update({
    where: { id: caseId },
    data: { resolvedAt: now, resolvedBy: adminId, resolution: 'force-completed' },
  });
  await AuditService.log({
    userId: adminId,
    action: 'STUCK_JOB_FORCE_COMPLETED',
    entityType: 'Booking',
    entityId: c.bookingId,
    metadata: { confirmedByCustomer, release: confirmedByCustomer ? 'immediate' : '24h' },
  }).catch(() => {});

  await sendForceCompleteNotice(c.bookingId, confirmedByCustomer).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[StuckJobs] Force-complete notice failed for ${c.bookingId}:`, e);
  });
  // Standard completion side-effect — the review request (guest skips log themselves).
  await EnhancedNotificationService.sendReviewRequest(c.bookingId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[ReviewRequest] Failed for booking ${c.bookingId}:`, e);
  });

  return { ok: true, released: confirmedByCustomer ? 'immediate' : '24h' };
}

/**
 * ADMIN BUTTON (money): cancel & refund. Reuses the EXISTING refundBooking
 * primitive (full remainder, all its guards and records), then closes the
 * booking the same way the dispute refund-customer leg does.
 */
export async function cancelRefund(
  caseId: string,
  adminId: string
): Promise<{ ok: true; refunded: number } | { ok: false; error: string; status: number }> {
  const c = await prisma.stuckJobCase.findUnique({
    where: { id: caseId },
    include: {
      booking: {
        select: {
          id: true,
          status: true,
          totalPrice: true,
          refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
        },
      },
    },
  });
  if (!c) return { ok: false, error: 'Case not found.', status: 404 };
  if (c.resolvedAt) return { ok: false, error: 'Case already resolved.', status: 400 };
  if (!actionArmed(c.scheduledEndAt)) {
    return {
      ok: false,
      error: 'Too early — admin actions arm 5 days after the scheduled end.',
      status: 400,
    };
  }
  if (!PRE_COMPLETE.includes(c.booking.status as (typeof PRE_COMPLETE)[number])) {
    return {
      ok: false,
      error: 'Booking is no longer in a pre-complete state — refresh.',
      status: 409,
    };
  }

  const refundedSoFar = c.booking.refundRecords.reduce((s, r) => s + Number(r.amount), 0);
  const remainder = Math.round((Number(c.booking.totalPrice) - refundedSoFar) * 100) / 100;
  if (remainder <= 0) {
    return { ok: false, error: 'Nothing left to refund on this booking.', status: 400 };
  }

  const { refundBooking } = await import('./refund.service');
  const result = await refundBooking(
    c.bookingId,
    remainder,
    'Stuck job — never completed; cancelled and refunded by admin',
    { triggeredBy: adminId }
  );
  if (result.status !== 'REFUNDED' && result.status !== 'PARTIALLY_REFUNDED') {
    // H78: admissible error copy — the admin must see WHAT refused and WHY,
    // not "action failed". The reason is Stripe's own message (or our guard's),
    // and it's also logged loudly in refund.service and persisted on the
    // FAILED RefundRecord.
    // eslint-disable-next-line no-console
    console.error(
      `[StuckJobs] Cancel-refund failed for ${c.bookingId}: ${result.status} — ${result.reason ?? 'no reason given'}`
    );
    return {
      ok: false,
      error: `Refund refused — ${result.reason ?? result.status}. The case stays open; if this booking was already refunded previously, use "Close without refund".`,
      status: 502,
    };
  }

  const now = new Date();
  await prisma.booking.updateMany({
    where: { id: c.bookingId, status: { in: [...PRE_COMPLETE] } },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancellationReason: 'Cancelled by Rena — job was never completed',
      transferStatus: 'REFUNDED',
    },
  });
  await prisma.stuckJobCase.update({
    where: { id: caseId },
    data: { resolvedAt: now, resolvedBy: adminId, resolution: 'cancelled-refunded' },
  });
  await AuditService.log({
    userId: adminId,
    action: 'STUCK_JOB_CANCELLED_REFUNDED',
    entityType: 'Booking',
    entityId: c.bookingId,
    metadata: { refunded: remainder },
  }).catch(() => {});

  await sendRefundConfirmationForBooking(c.bookingId, remainder, true).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[StuckJobs] Refund confirmation email failed for ${c.bookingId}:`, e);
  });

  return { ok: true, refunded: remainder };
}

/**
 * H78: ADMIN BUTTON (records only — moves NO money, calls NO provider):
 * close an aged case whose payment was already refunded through an earlier
 * path (a prior walk, a different Stripe era, a manual dashboard refund).
 * The booking closes the same terminal shape as the refunded leg —
 * CANCELLED / transferStatus REFUNDED with an honest reason — but no charge
 * is touched. Armed-gated and audited like the money buttons; the audit row
 * is the record that an admin attested "refund already issued previously".
 */
export async function resolveNoRefund(
  caseId: string,
  adminId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const c = await prisma.stuckJobCase.findUnique({
    where: { id: caseId },
    include: { booking: { select: { id: true, status: true } } },
  });
  if (!c) return { ok: false, error: 'Case not found.', status: 404 };
  if (c.resolvedAt) return { ok: false, error: 'Case already resolved.', status: 400 };
  if (!actionArmed(c.scheduledEndAt)) {
    return {
      ok: false,
      error: 'Too early — admin actions arm 5 days after the scheduled end.',
      status: 400,
    };
  }
  if (!PRE_COMPLETE.includes(c.booking.status as (typeof PRE_COMPLETE)[number])) {
    return {
      ok: false,
      error: 'Booking is no longer in a pre-complete state — refresh.',
      status: 409,
    };
  }

  const now = new Date();
  await prisma.booking.updateMany({
    where: { id: c.bookingId, status: { in: [...PRE_COMPLETE] } },
    data: {
      status: 'CANCELLED',
      cancelledAt: now,
      cancellationReason: 'Closed by Rena — refund was already issued previously',
      transferStatus: 'REFUNDED',
    },
  });
  await prisma.stuckJobCase.update({
    where: { id: caseId },
    data: { resolvedAt: now, resolvedBy: adminId, resolution: 'resolved-no-refund' },
  });
  await AuditService.log({
    userId: adminId,
    action: 'STUCK_JOB_RESOLVED_NO_REFUND',
    entityType: 'Booking',
    entityId: c.bookingId,
    metadata: { attested: 'refund already issued previously' },
  }).catch(() => {});
  // eslint-disable-next-line no-console
  console.log(
    `[StuckJobs] Case for ${c.bookingId} closed without refund (admin ${adminId} attested prior refund)`
  );
  return { ok: true };
}
