// B4 dispute resolution (RENA-013, RENA-092).
//
// One interactive transaction moves the dispute OPEN|UNDER_REVIEW →
// RESOLVING_REFUND|RESOLVING_RELEASE and the booking out of DISPUTED, each
// guarded; if either guard misses, nothing is written and the caller answers
// 409. Then the money step runs. RESOLVED (and the final messages) is written
// only after the money is confirmed: the refund record SUCCEEDED, or the
// transfer RELEASED. A failure leaves the dispute RESOLVING with lastMoneyError
// and a backoff; retryResolvingDisputes re-runs the same step idempotently
// (the same refund record, the same keys), and the row is visible in stuck-money.
//
// | dispute              | event                            | next                 |
// | OPEN or UNDER_REVIEW | resolve refund or split          | RESOLVING_REFUND     |
// | OPEN or UNDER_REVIEW | resolve release                  | RESOLVING_RELEASE    |
// | RESOLVING_REFUND     | refund SUCCEEDED, outcome refund | RESOLVED             |
// | RESOLVING_REFUND     | refund SUCCEEDED, outcome split  | RESOLVING_RELEASE    |
// | RESOLVING_RELEASE    | transfer RELEASED                | RESOLVED             |
// | RESOLVING_*          | failure                          | unchanged, retried   |

import type { BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { nextRetryAt } from '@/lib/money/ledger';

import { AuditService } from './audit.service';

export type DisputeOutcome = 'release-to-cleaner' | 'refund-customer' | 'split';

export class DisputeConflictError extends Error {
  constructor(message = 'The dispute or the booking changed state — nothing was written') {
    super(message);
    this.name = 'DisputeConflictError';
  }
}

export interface DisputeResolutionResult {
  outcome: DisputeOutcome;
  disputeStatus: string;
  refundedAmount: number;
  refundStatus?: string;
  releaseStatus?: string;
  lastMoneyError?: string | null;
}

export async function startDisputeResolution(params: {
  disputeId: string;
  outcome: DisputeOutcome;
  resolution: string;
  refundAmount?: number;
  adminId: string;
}): Promise<DisputeResolutionResult> {
  const { disputeId, outcome, resolution, adminId } = params;
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { select: { id: true, status: true, completedAt: true } } },
  });
  if (!dispute) throw new Error('Dispute not found');
  if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
    throw new DisputeConflictError(`Dispute is already ${dispute.status.toLowerCase()}`);
  }
  if (dispute.booking.status !== 'DISPUTED') {
    throw new DisputeConflictError(`Booking is ${dispute.booking.status}, not DISPUTED`);
  }

  // The remainder from the ledger (never totalPrice; null while reconciling).
  const { remainingRefundableFor } = await import('./refund.service');
  const remainderPence = await remainingRefundableFor(dispute.bookingId);
  let amountPence: number | null = null;
  if (outcome === 'refund-customer' || outcome === 'split') {
    if (remainderPence === null) {
      throw new Error('An earlier refund on this booking is still being reconciled with Stripe');
    }
    amountPence =
      outcome === 'refund-customer' ? remainderPence : Math.round((params.refundAmount ?? 0) * 100);
    if (!amountPence || amountPence <= 0)
      throw new Error('A refund amount is required for this outcome');
    // A split that refunds everything leaves nothing to release: that is a
    // refund-customer outcome (gate review finding 5).
    if (outcome === 'split' && amountPence >= remainderPence) {
      throw new Error(
        'A split must leave part of the payment to release; use refund-customer instead'
      );
    }
    if (amountPence > remainderPence) {
      throw new Error(
        `Refund £${(amountPence / 100).toFixed(2)} exceeds refundable remainder £${(remainderPence / 100).toFixed(2)}`
      );
    }
  }

  const nextBookingStatus: BookingStatus =
    outcome === 'refund-customer' ? 'CANCELLED' : 'COMPLETED';
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const d = await tx.dispute.updateMany({
      where: { id: disputeId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      data: {
        status: outcome === 'release-to-cleaner' ? 'RESOLVING_RELEASE' : 'RESOLVING_REFUND',
        resolution,
        resolutionOutcome: outcome,
        resolutionAmountPence: amountPence,
        resolvingSince: now,
        resolvedById: adminId,
        lastMoneyError: null,
        retryCount: 0,
        nextRetryAt: nextRetryAt(now, 0),
      },
    });
    const b = await tx.booking.updateMany({
      where: { id: dispute.bookingId, status: 'DISPUTED' },
      data: {
        status: nextBookingStatus,
        ...(outcome === 'refund-customer'
          ? { cancelledAt: now, cancellationReason: `Dispute resolved: ${resolution}` }
          : {}),
        // H81: a booking disputed straight from IN_PROGRESS never had
        // completedAt; landing in COMPLETED stamps the resolution time.
        ...(nextBookingStatus === 'COMPLETED' && !dispute.booking.completedAt
          ? { completedAt: now }
          : {}),
      },
    });
    if (d.count !== 1 || b.count !== 1) throw new DisputeConflictError();
  });

  await AuditService.log({
    userId: adminId,
    action: 'ADMIN_RESOLVE_DISPUTE',
    entityType: 'Dispute',
    entityId: disputeId,
    metadata: {
      bookingId: dispute.bookingId,
      outcome,
      resolution,
      amountPence,
      phase: 'RESOLVING',
    },
  }).catch(() => {});

  return runDisputeMoneyStep(disputeId);
}

const MONEY_STEP_LEASE_MS = 10 * 60_000;

/**
 * The money step, idempotent and single flight (gate review finding 3): a
 * lease on the dispute, claimed by CAS, so the scheduler's retry and an
 * admin's Retry never run it at once. A lease left by a crash expires.
 */
export async function runDisputeMoneyStep(disputeId: string): Promise<DisputeResolutionResult> {
  const now = new Date();
  const lease = await prisma.dispute.updateMany({
    where: {
      id: disputeId,
      OR: [
        { moneyStepLockedAt: null },
        { moneyStepLockedAt: { lt: new Date(now.getTime() - MONEY_STEP_LEASE_MS) } },
      ],
    },
    data: { moneyStepLockedAt: now },
  });
  if (lease.count !== 1) {
    const d = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    return {
      outcome: (d.resolutionOutcome ?? 'release-to-cleaner') as DisputeOutcome,
      refundedAmount: 0,
      disputeStatus: d.status,
      lastMoneyError: 'The money step is already running',
    };
  }
  try {
    return await moneyStepUnderLease(disputeId);
  } finally {
    await prisma.dispute
      .updateMany({
        where: { id: disputeId, moneyStepLockedAt: now },
        data: { moneyStepLockedAt: null },
      })
      .catch(() => {});
  }
}

async function moneyStepUnderLease(disputeId: string): Promise<DisputeResolutionResult> {
  let d = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
  const outcome = (d.resolutionOutcome ?? 'release-to-cleaner') as DisputeOutcome;
  const base = { outcome, refundedAmount: 0 } as DisputeResolutionResult;

  if (d.status === 'RESOLVING_REFUND') {
    const r = await ensureDisputeRefund(d);
    base.refundStatus = r.recordStatus;
    base.refundedAmount = r.executedPence / 100;
    if (r.recordStatus !== 'SUCCEEDED') {
      return recordFailure(d.id, r.error ?? `Refund ${r.recordStatus.toLowerCase()}`, base);
    }
    if (outcome === 'refund-customer') return resolve(d.id, base);
    await prisma.dispute.updateMany({
      where: { id: d.id, status: 'RESOLVING_REFUND' },
      data: { status: 'RESOLVING_RELEASE' },
    });
    d = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
  }

  if (d.status === 'RESOLVING_RELEASE') {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: d.bookingId },
      select: { transferStatus: true },
    });
    if (booking.transferStatus !== 'RELEASED') {
      const audit = {
        trigger: 'DISPUTE_RESOLUTION' as const,
        actorId: d.resolvedById ?? undefined,
      };
      const { releaseBookingFunds, resumePausedRelease } = await import('./transfer.service');
      const release =
        booking.transferStatus === 'PAUSED'
          ? await resumePausedRelease(d.bookingId, audit)
          : await releaseBookingFunds(d.bookingId, audit);
      base.releaseStatus = release.status;
      if (release.status !== 'RELEASED' && release.status !== 'ALREADY_RELEASED') {
        return recordFailure(
          d.id,
          release.reason ?? `Release ${release.status.toLowerCase()}`,
          base
        );
      }
    } else {
      base.releaseStatus = 'ALREADY_RELEASED';
    }
    return resolve(d.id, base);
  }

  return { ...base, disputeStatus: d.status, lastMoneyError: d.lastMoneyError };
}

/** The resolution's one refund: created once, then retried or reconciled. */
async function ensureDisputeRefund(d: {
  id: string;
  bookingId: string;
  refundRecordId: string | null;
  resolutionAmountPence: number | null;
  resolution: string | null;
  resolutionOutcome: string | null;
  resolvedById: string | null;
}): Promise<{ recordStatus: string; executedPence: number; error?: string }> {
  const refund = await import('./refund.service');
  if (d.refundRecordId) {
    let rec = await prisma.refundRecord.findUniqueOrThrow({ where: { id: d.refundRecordId } });
    if (rec.status === 'PENDING' || rec.status === 'UNKNOWN') {
      await refund.reconcileRecordSlices(rec.id);
      rec = await prisma.refundRecord.findUniqueOrThrow({ where: { id: rec.id } });
    } else if (rec.status === 'FAILED' || rec.status === 'PARTIAL') {
      const r = await refund.retryRefundRemainder(rec.id, d.resolvedById ?? undefined);
      rec = await prisma.refundRecord.findUniqueOrThrow({ where: { id: rec.id } });
      return { recordStatus: rec.status, executedPence: rec.executedPence, error: r.reason };
    }
    return {
      recordStatus: rec.status,
      executedPence: rec.executedPence,
      error: rec.failureReason ?? undefined,
    };
  }
  const amount = (d.resolutionAmountPence ?? 0) / 100;
  const isRefund = d.resolutionOutcome === 'refund-customer';
  const result = await refund.refundBooking(
    d.bookingId,
    amount,
    isRefund ? `Dispute resolved: ${d.resolution}` : `Dispute resolved (split): ${d.resolution}`,
    {
      triggeredBy: d.resolvedById ?? undefined,
      ...(isRefund
        ? {
            bookingDataOverride: {
              cancelledAt: new Date(),
              cancellationReason: `Dispute resolved: ${d.resolution}`,
            },
          }
        : {}),
    }
  );
  // Never adopt a record that did not run (SKIPPED: the booking claim was
  // held elsewhere); the step is retried instead (gate review finding 3).
  if (!result.refundRecordId || result.status === 'SKIPPED') {
    return { recordStatus: 'FAILED', executedPence: 0, error: result.reason };
  }
  const adopted = await prisma.dispute.updateMany({
    where: { id: d.id, refundRecordId: null },
    data: { refundRecordId: result.refundRecordId },
  });
  if (adopted.count !== 1) {
    log.error('dispute', 'second_refund_record_not_adopted', {
      disputeId: d.id,
      refundRecordId: result.refundRecordId,
    });
    return {
      recordStatus: 'FAILED',
      executedPence: 0,
      error: 'A refund record is already attached',
    };
  }
  const rec = await prisma.refundRecord.findUniqueOrThrow({ where: { id: result.refundRecordId } });
  return { recordStatus: rec.status, executedPence: rec.executedPence, error: result.reason };
}

async function recordFailure(
  disputeId: string,
  error: string,
  base: DisputeResolutionResult
): Promise<DisputeResolutionResult> {
  const d = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      lastMoneyError: error,
      retryCount: d.retryCount + 1,
      nextRetryAt: nextRetryAt(new Date(), d.retryCount + 1),
    },
  });
  log.warn('dispute', 'money_step_pending', { disputeId, bookingId: d.bookingId });
  return { ...base, disputeStatus: d.status, lastMoneyError: error };
}

/** RESOLVED and the final messages, written once by whoever wins the CAS. */
async function resolve(
  disputeId: string,
  base: DisputeResolutionResult
): Promise<DisputeResolutionResult> {
  const won = await prisma.dispute.updateMany({
    where: { id: disputeId, status: { in: ['RESOLVING_REFUND', 'RESOLVING_RELEASE'] } },
    data: { status: 'RESOLVED', resolvedAt: new Date(), lastMoneyError: null, nextRetryAt: null },
  });
  const d = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: { booking: { select: { cleanerId: true, clientId: true, date: true } } },
  });
  if (won.count === 1) {
    const outcome = base.outcome;
    await notifyDisputeResolved(d.booking, outcome, d.resolution ?? '').catch(() => {});
    const { sendDisputeResolutionEmails } = await import('./email.service');
    await sendDisputeResolutionEmails({
      bookingId: d.bookingId,
      outcome,
      refundAmount: base.refundedAmount > 0 ? base.refundedAmount : undefined,
      refundSucceeded: base.refundStatus === 'SUCCEEDED',
    }).catch((err) => {
      log.error('dispute', 'resolution_emails_failed', { disputeId }, err);
    });
    await AuditService.log({
      userId: d.resolvedById ?? undefined,
      action: 'ADMIN_RESOLVE_DISPUTE',
      entityType: 'Dispute',
      entityId: disputeId,
      metadata: {
        bookingId: d.bookingId,
        outcome,
        phase: 'RESOLVED',
        refundedAmount: base.refundedAmount,
        refundStatus: base.refundStatus,
        releaseStatus: base.releaseStatus,
      },
    }).catch(() => {});
  }
  return { ...base, disputeStatus: 'RESOLVED', lastMoneyError: null };
}

/**
 * Scheduler: RESOLVING rows older than two minutes whose backoff has passed,
 * 20 per tick, re-run the money step (same record, same keys).
 */
export async function retryResolvingDisputes(): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.dispute.findMany({
    where: {
      status: { in: ['RESOLVING_REFUND', 'RESOLVING_RELEASE'] },
      resolvingSince: { lt: new Date(now.getTime() - 2 * 60_000) },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    select: { id: true },
    take: 20,
  });
  let processed = 0;
  for (const d of due) {
    try {
      const r = await runDisputeMoneyStep(d.id);
      if (r.disputeStatus === 'RESOLVED') processed++;
    } catch (err) {
      log.error('dispute', 'money_step_retry_threw', { disputeId: d.id }, err);
    }
  }
  return { processed };
}

// ─── Notification helper (best-effort) ────────────────────

async function notifyDisputeResolved(
  booking: { cleanerId: string; clientId: string | null; date: Date },
  outcome: DisputeOutcome,
  resolution: string
): Promise<void> {
  const dateStr = booking.date.toLocaleDateString('en-GB');
  const messages: Record<DisputeOutcome, { cleaner: string; customer: string }> = {
    'release-to-cleaner': {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved in your favour. Your payment will be released.`,
      customer: `The dispute on your booking (${dateStr}) has been reviewed and resolved. The cleaner will be paid as normal.`,
    },
    'refund-customer': {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved. The customer has been refunded.`,
      customer: `The dispute on your booking (${dateStr}) has been resolved in your favour. A full refund is being processed.`,
    },
    split: {
      cleaner: `The dispute on your booking (${dateStr}) has been resolved with a partial adjustment. Your reduced payment will be released.`,
      customer: `The dispute on your booking (${dateStr}) has been resolved. A partial refund is being processed.`,
    },
  };
  const msgs = messages[outcome];
  await prisma.notification
    .create({
      data: {
        userId: booking.cleanerId,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute resolved',
        body: msgs.cleaner,
        data: { resolution },
      },
    })
    .catch(() => {});
  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'DISPUTE_RESOLVED',
          title: 'Dispute resolved',
          body: msgs.customer,
          data: { resolution },
        },
      })
      .catch(() => {});
  }
}
