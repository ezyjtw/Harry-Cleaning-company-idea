// ─── B4 refunds as slices (RENA-010, 011, 088, 089) ──────────────────────────
//
// Single owner of all refund money movement: no other code calls
// stripe.refunds.create() or stripe.transfers.createReversal(). (The B4 build
// deleted the admin retry-refund route that was the one ruled exception; its
// work is retryRefundRemainder below, reached from the stuck-money queue.)
//
// A refund is a RefundRecord (what was asked) and one RefundSlice per charge it
// touches (what Stripe was asked and what it executed), allocated LIFO over the
// booking's succeeded top-ups then the original. Each slice is written PENDING
// with its own idempotency key before Stripe is called, and ends SUCCEEDED,
// FAILED, or UNKNOWN after one same-key retry. UNKNOWN is reconciled by reading
// Stripe, never re-executed. After every slice outcome the record's derived
// status and the booking's refund state are written in one transaction
// (money/ledger-db.ts). Post-release, the cleaner's share is reversed first,
// proportionally across the booking's transfer slices, one TransferReversal row
// per slice.
//
// finalizeRefundRecord applies the consequences of executed money exactly once
// per penny (transfer state, pre-release earnings scaling, the caller's booking
// override, Xero, messages), in-line or later when an unknown outcome resolves.

import { randomUUID } from 'crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import {
  allocateRefund,
  allocateReversal,
  cleanerSharePence,
  isUnknownStripeOutcome,
  isUnresolved,
  nextRetryAt,
  remainingRefundablePence,
  toPence,
} from '@/lib/money/ledger';
import {
  chargesLifo,
  loadBookingLedger,
  recomputeBookingRefundState,
  recomputeRefundRecord,
  remainingShareablePence,
  type BookingLedger,
} from '@/lib/money/ledger-db';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';
import { TOPUP_WITHOUT_ASSIGNMENT } from './topup-flag';
import { enqueueXeroPush } from './xero-push.service';

// ─── Types ─────────────────────────────────────────────────

export interface RefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED' | 'SKIPPED';
  refundRecordId?: string;
  stripeRefundId?: string;
  amountRefunded?: number;
  reason?: string;
  /** LEDGER_RECONCILIATION_PENDING, OUTCOME_UNKNOWN, PARTIAL, ... */
  code?: string;
}

export interface RefundOptions {
  triggeredBy?: string;
  adjustEarnings?: boolean;
  bookingDataOverride?: Record<string, unknown>;
  /** Confine the refund to one charge (the TOPUP_WITHOUT_ASSIGNMENT refund). */
  onlyPaymentIntentId?: string;
}

interface RecordContext {
  prevTransferStatus: string;
  isPostRelease: boolean;
  adjustEarnings: boolean;
  bookingDataOverride?: Record<string, unknown>;
  reason: string;
  triggeredBy?: string;
  /** The cleaner share this record reverses (post-release). */
  reversalTargetPence: number;
  /** Executed shareable pence already accounted for by finalisation. */
  finalizedShareablePence?: number;
  /** Slice ids already mirrored to Xero. */
  xeroSliceIds?: string[];
  /** The record finished later than its request (send the confirmation email). */
  late?: boolean;
}

export const LEDGER_RECONCILIATION_PENDING = 'LEDGER_RECONCILIATION_PENDING';

// ─── refundBooking ─────────────────────────────────────────

export async function refundBooking(
  bookingId: string,
  amountPounds: number,
  reason: string,
  options: RefundOptions = {}
): Promise<RefundResult> {
  const { triggeredBy, adjustEarnings = true, bookingDataOverride, onlyPaymentIntentId } = options;
  const amountPence = Math.round(amountPounds * 100);

  const ledger = await loadBookingLedger(prisma, bookingId);
  if (!ledger) return { status: 'FAILED', reason: 'Booking not found' };
  const { booking } = ledger;

  // A disputed booking's refund goes through resolveDispute (which moves the
  // booking out of DISPUTED first) so the dispute and the money stay one story.
  if (booking.status === 'DISPUTED') {
    return {
      status: 'FAILED',
      reason: 'Cannot refund a disputed booking — resolve the dispute instead',
    };
  }
  if (!booking.stripePaymentIntentId) {
    return { status: 'FAILED', reason: 'No payment intent on booking' };
  }
  if (booking.paymentStatus !== 'SUCCEEDED' && booking.paymentStatus !== 'PARTIALLY_REFUNDED') {
    return {
      status: 'FAILED',
      reason: `Cannot refund — payment status is ${booking.paymentStatus}`,
    };
  }
  if (amountPence <= 0) return { status: 'FAILED', reason: 'Refund amount must be positive' };

  // Never guessed (James-ruled): a slice whose outcome is not yet read from
  // Stripe blocks every new refund on the booking until it is reconciled.
  const remaining = remainingRefundablePence(ledger.chargedPence, ledger.slices);
  if (remaining === null) {
    return {
      status: 'FAILED',
      code: LEDGER_RECONCILIATION_PENDING,
      reason: 'An earlier refund on this booking is still being reconciled with Stripe',
    };
  }
  if (amountPence > remaining + 1) {
    return {
      status: 'FAILED',
      reason: `Refund £${amountPounds.toFixed(2)} exceeds refundable £${(remaining / 100).toFixed(2)}`,
    };
  }

  if (booking.transferStatus === 'RELEASING' || booking.transferStatus === 'UNKNOWN') {
    return { status: 'FAILED', reason: 'Transfer in flight — retry later' };
  }
  if (booking.transferStatus === 'REFUNDED') {
    return { status: 'SKIPPED', reason: 'Booking already fully refunded' };
  }
  const isPostRelease = booking.transferStatus === 'RELEASED';
  if (isPostRelease && ledger.transferSlices.some((s) => s.amountPence === null)) {
    return {
      status: 'FAILED',
      code: LEDGER_RECONCILIATION_PENDING,
      reason: 'The payout on this booking is still being reconciled with Stripe',
    };
  }

  const plan = allocateRefund(
    chargesLifo(ledger),
    Math.min(amountPence, remaining),
    onlyPaymentIntentId
  );
  if (plan.shortfallPence > 0 || plan.slices.length === 0) {
    return { status: 'FAILED', reason: 'The refund does not fit the charges on this booking' };
  }

  // The cleaner's share of the shareable part (B3 R2: a flagged top-up carries none).
  const refundShareable = plan.slices
    .filter((s) => !s.flagged)
    .reduce((sum, s) => sum + s.pence, 0);
  const cleanerRemainingPostRelease = ledger.transferSlices.reduce(
    (sum, s) => sum + Math.max(0, (s.amountPence ?? 0) - s.reversedPence),
    0
  );
  const reversalTargetPence = isPostRelease
    ? cleanerSharePence({
        cleanerRemainingPence: cleanerRemainingPostRelease,
        remainingShareablePence: remainingShareablePence(ledger),
        refundShareablePence: refundShareable,
      })
    : 0;

  const context: RecordContext = {
    prevTransferStatus: booking.transferStatus,
    isPostRelease,
    adjustEarnings,
    bookingDataOverride,
    reason,
    triggeredBy,
    reversalTargetPence,
    finalizedShareablePence: 0,
    xeroSliceIds: [],
  };

  const record = await prisma.refundRecord.create({
    data: {
      bookingId,
      amount: amountPence / 100,
      requestedPence: amountPence,
      reason,
      triggeredBy,
      status: 'PENDING',
      context: context as unknown as Prisma.InputJsonValue,
    },
  });

  // Mutual exclusion with releaseBookingFunds: REFUNDING is not claimable by release.
  const claimable = isPostRelease ? ['RELEASED'] : ['PENDING', 'FAILED', 'PAUSED'];
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: { in: claimable } },
    data: { transferStatus: 'REFUNDING' },
  });
  if (claimed.count === 0) {
    await prisma.refundRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', failureReason: 'Could not acquire lock', finalizedAt: new Date() },
    });
    return {
      status: 'SKIPPED',
      refundRecordId: record.id,
      reason: 'Another operation is in progress',
    };
  }

  return runRecord(record.id, bookingId, plan.slices, 1);
}

/**
 * Execute a record round: the reversal (post-release), then the refund slices,
 * then finalisation. Used by refundBooking (round 1) and retryRefundRemainder.
 */
async function runRecord(
  recordId: string,
  bookingId: string,
  planned: { paymentIntentId: string; chargeId: string | null; pence: number }[],
  attempt: number
): Promise<RefundResult> {
  const record = await prisma.refundRecord.findUniqueOrThrow({ where: { id: recordId } });
  const ctx = record.context as unknown as RecordContext;
  await prisma.refundRecord.update({ where: { id: recordId }, data: { attempt } });

  if (ctx.isPostRelease && ctx.reversalTargetPence > 0) {
    const rev = await reverseCleanerShare(recordId, bookingId, ctx.reversalTargetPence, attempt);
    if (rev.outcome !== 'OK') {
      const hasReversed = await reversedForRecord(recordId);
      await prisma.refundRecord.update({
        where: { id: recordId },
        data: {
          status: rev.outcome === 'UNKNOWN' ? 'UNKNOWN' : 'FAILED',
          failureReason: rev.reason,
          ...(rev.outcome === 'FAILED' ? { finalizedAt: new Date() } : {}),
        },
      });
      // A definitive failure with nothing reversed releases the claim; any
      // reversal that landed (or may have) keeps REFUNDING so release cannot
      // re-pay the cleaner, and the record sits in stuck-money.
      if (rev.outcome === 'FAILED' && hasReversed === 0) {
        await prisma.booking.updateMany({
          where: { id: bookingId, transferStatus: 'REFUNDING' },
          data: { transferStatus: ctx.prevTransferStatus },
        });
      }
      log.error('refund', rev.outcome === 'UNKNOWN' ? 'reversal_unknown' : 'reversal_failed', {
        bookingId,
        refundRecordId: recordId,
      });
      return {
        status: 'FAILED',
        refundRecordId: recordId,
        code: rev.outcome === 'UNKNOWN' ? 'OUTCOME_UNKNOWN' : undefined,
        reason: rev.reason,
      };
    }
  }

  // The slices, PENDING before any Stripe call.
  const rows = planned.map((p) => {
    const id = randomUUID();
    return {
      id,
      refundRecordId: recordId,
      stripePaymentIntentId: p.paymentIntentId,
      stripeChargeId: p.chargeId,
      requestedPence: p.pence,
      status: 'PENDING',
      idempotencyKey: `refund_${recordId}_${id}_v${attempt}`,
      attempt,
    };
  });
  await prisma.refundSlice.createMany({ data: rows });

  for (let i = 0; i < rows.length; i++) {
    const outcome = await executeRefundSlice(rows[i].id, bookingId);
    if (outcome !== 'SUCCEEDED' && outcome !== 'PENDING') {
      // Stop at the first slice that did not land: later slices were never sent.
      const rest = rows.slice(i + 1).map((r) => r.id);
      if (rest.length) {
        await prisma.$transaction(async (tx) => {
          await tx.refundSlice.updateMany({
            where: { id: { in: rest }, status: 'PENDING' },
            data: {
              status: 'FAILED',
              lastReconcileResult: 'not sent: an earlier slice did not land',
            },
          });
          await recomputeRefundRecord(tx, recordId);
          await recomputeBookingRefundState(tx, bookingId);
        });
      }
      break;
    }
  }

  return finalizeRefundRecord(recordId);
}

// ─── One slice ─────────────────────────────────────────────

type SliceOutcome = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'PENDING';

async function executeRefundSlice(sliceId: string, bookingId: string): Promise<SliceOutcome> {
  const slice = await prisma.refundSlice.findUniqueOrThrow({ where: { id: sliceId } });
  const params = {
    payment_intent: slice.stripePaymentIntentId,
    amount: slice.requestedPence,
    metadata: { bookingId, refundRecordId: slice.refundRecordId, refundSliceId: slice.id },
  };
  let refund: Awaited<ReturnType<typeof stripe.refunds.create>> | null = null;
  let failure: string | null = null;
  let unknown = false;
  try {
    refund = await stripe.refunds.create(params, { idempotencyKey: slice.idempotencyKey });
  } catch (err) {
    if (isUnknownStripeOutcome(err)) {
      try {
        // One same-key retry: Stripe answers with the original if it landed.
        refund = await stripe.refunds.create(params, { idempotencyKey: slice.idempotencyKey });
      } catch (retryErr) {
        unknown = isUnknownStripeOutcome(retryErr);
        failure = retryErr instanceof Error ? retryErr.message : 'Stripe error';
      }
    } else {
      failure = err instanceof Error ? err.message : 'Stripe error';
    }
  }

  if (refund) return writeSliceFromRefund(sliceId, bookingId, refund);

  await prisma.$transaction(async (tx) => {
    await tx.refundSlice.updateMany({
      where: { id: sliceId, status: 'PENDING' },
      data: unknown
        ? {
            status: 'UNKNOWN',
            lastReconcileResult: `outcome unknown after a same-key retry: ${failure}`,
            nextRetryAt: nextRetryAt(new Date(), 0),
          }
        : { status: 'FAILED', lastReconcileResult: `refused: ${failure}` },
    });
    await recomputeRefundRecord(tx, slice.refundRecordId);
    await recomputeBookingRefundState(tx, bookingId);
  });
  log.error('refund', unknown ? 'slice_unknown' : 'slice_refused', {
    bookingId,
    refundRecordId: slice.refundRecordId,
    refundSliceId: sliceId,
  });
  return unknown ? 'UNKNOWN' : 'FAILED';
}

/** Write a slice from a Stripe Refund object; guarded so a duplicate changes nothing. */
async function writeSliceFromRefund(
  sliceId: string,
  bookingId: string,
  refund: { id: string; amount: number; status: string | null }
): Promise<SliceOutcome> {
  const status: SliceOutcome =
    refund.status === 'succeeded'
      ? 'SUCCEEDED'
      : refund.status === 'failed' || refund.status === 'canceled'
        ? 'FAILED'
        : 'PENDING';
  const slice = await prisma.refundSlice.findUniqueOrThrow({
    where: { id: sliceId },
    select: { refundRecordId: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.refundSlice.updateMany({
      where: { id: sliceId, status: { in: ['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'] } },
      data: {
        stripeRefundId: refund.id,
        status,
        executedPence: status === 'SUCCEEDED' ? refund.amount : 0,
        lastReconciledAt: new Date(),
        lastReconcileResult: `stripe refund ${refund.status}`,
      },
    });
    await recomputeRefundRecord(tx, slice.refundRecordId);
    await recomputeBookingRefundState(tx, bookingId);
  });
  return status;
}

// ─── Reversals across transfer slices (RENA-010) ────────────

async function reversedForRecord(recordId: string): Promise<number> {
  const rows = await prisma.transferReversal.findMany({
    where: { refundRecordId: recordId, status: { in: ['SUCCEEDED', 'UNKNOWN', 'PENDING'] } },
    select: { amountPence: true },
  });
  return rows.reduce((s, r) => s + r.amountPence, 0);
}

async function reverseCleanerShare(
  recordId: string,
  bookingId: string,
  targetPence: number,
  attempt: number
): Promise<{ outcome: 'OK' | 'FAILED' | 'UNKNOWN'; reason?: string }> {
  const already = await prisma.transferReversal.findMany({
    where: { refundRecordId: recordId },
    select: { status: true, amountPence: true },
  });
  if (already.some((r) => r.status === 'UNKNOWN' || r.status === 'PENDING')) {
    return {
      outcome: 'UNKNOWN',
      reason: 'A reversal on this refund is still unknown — reconcile it first',
    };
  }
  const done = already
    .filter((r) => r.status === 'SUCCEEDED')
    .reduce((s, r) => s + r.amountPence, 0);
  const need = targetPence - done;
  if (need <= 0) return { outcome: 'OK' };

  const slices = await prisma.transferSlice.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
  });
  const plan = allocateReversal(slices, need);
  if (!plan) {
    return {
      outcome: 'FAILED',
      reason: 'The payout on this booking is still being reconciled with Stripe',
    };
  }
  if (plan.shortfallPence > 0) {
    return { outcome: 'FAILED', reason: 'The payout holds less than the cleaner share to reverse' };
  }

  for (const part of plan.parts) {
    const slice = slices.find((s) => s.id === part.sliceId);
    if (!slice) continue;
    const row = await prisma.transferReversal.create({
      data: {
        transferSliceId: slice.id,
        refundRecordId: recordId,
        amountPence: part.pence,
        status: 'PENDING',
        idempotencyKey: `reversal_${recordId}_${slice.id}_v${attempt}`,
        attempt,
      },
    });
    const params = {
      amount: part.pence,
      metadata: { bookingId, refundRecordId: recordId, transferReversalId: row.id },
    };
    let reversal: { id: string; amount: number } | null = null;
    let failure: string | null = null;
    let unknown = false;
    try {
      reversal = await stripe.transfers.createReversal(slice.stripeTransferId, params, {
        idempotencyKey: row.idempotencyKey,
      });
    } catch (err) {
      if (isUnknownStripeOutcome(err)) {
        try {
          reversal = await stripe.transfers.createReversal(slice.stripeTransferId, params, {
            idempotencyKey: row.idempotencyKey,
          });
        } catch (retryErr) {
          unknown = isUnknownStripeOutcome(retryErr);
          failure = retryErr instanceof Error ? retryErr.message : 'Stripe error';
        }
      } else {
        failure = err instanceof Error ? err.message : 'Stripe error';
      }
    }
    if (reversal) {
      await confirmReversal(row.id, reversal);
      continue;
    }
    await prisma.transferReversal.update({
      where: { id: row.id },
      data: unknown
        ? {
            status: 'UNKNOWN',
            lastReconcileResult: `outcome unknown after a same-key retry: ${failure}`,
            nextRetryAt: nextRetryAt(new Date(), 0),
          }
        : { status: 'FAILED', lastReconcileResult: `refused: ${failure}` },
    });
    return unknown
      ? { outcome: 'UNKNOWN', reason: 'Transfer reversal outcome unknown — reconcile with Stripe' }
      : { outcome: 'FAILED', reason: `Transfer reversal refused: ${failure}` };
  }
  return { outcome: 'OK' };
}

/** A reversal Stripe confirmed: the row and its slice's reversed total, once. */
async function confirmReversal(
  rowId: string,
  reversal: { id: string; amount: number }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const moved = await tx.transferReversal.updateMany({
      where: { id: rowId, status: { in: ['PENDING', 'UNKNOWN'] } },
      data: {
        status: 'SUCCEEDED',
        stripeReversalId: reversal.id,
        amountPence: reversal.amount,
        lastReconciledAt: new Date(),
      },
    });
    if (moved.count !== 1) return;
    const row = await tx.transferReversal.findUniqueOrThrow({ where: { id: rowId } });
    const slice = await tx.transferSlice.update({
      where: { id: row.transferSliceId },
      data: { reversedPence: { increment: reversal.amount } },
    });
    const fully = slice.amountPence !== null && slice.reversedPence >= slice.amountPence;
    await tx.transferSlice.update({
      where: { id: slice.id },
      data: { status: fully ? 'REVERSED' : 'PARTIALLY_REVERSED' },
    });
  });
}

// ─── Finalisation, exactly once per executed penny ─────────

export async function finalizeRefundRecord(recordId: string): Promise<RefundResult> {
  const record = await prisma.refundRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { slices: true },
  });
  const ctx = (record.context ?? {}) as unknown as RecordContext;
  const bookingId = record.bookingId;
  const status = await prisma.$transaction((tx) => recomputeRefundRecord(tx, recordId));

  if (status === 'PENDING' || status === 'UNKNOWN') {
    // The claim stays REFUNDING; the reconciliation (or the webhook) finishes it.
    return {
      status: 'FAILED',
      refundRecordId: recordId,
      code: 'OUTCOME_UNKNOWN',
      amountRefunded: record.executedPence / 100,
      reason: 'Unknown outcome — refund may have processed. It is being reconciled with Stripe.',
    };
  }

  const ledger = await loadBookingLedger(prisma, bookingId);
  if (!ledger) return { status: 'FAILED', refundRecordId: recordId, reason: 'Booking not found' };
  const executed = record.slices
    .filter((s) => s.status === 'SUCCEEDED')
    .reduce((sum, s) => sum + s.executedPence, 0);
  const delta = executed - record.finalizedExecutedPence;

  if (executed === 0) {
    // Nothing moved for the customer.
    const reversed = await reversedForRecord(recordId);
    if (reversed > 0) {
      await prisma.refundRecord.update({
        where: { id: recordId },
        data: {
          failureReason:
            record.failureReason ??
            'Reversal succeeded but the customer refund failed — retry the remainder',
          finalizedAt: record.finalizedAt ?? new Date(),
        },
      });
    } else {
      await prisma.booking.updateMany({
        where: { id: bookingId, transferStatus: 'REFUNDING' },
        data: { transferStatus: ctx.prevTransferStatus },
      });
      await prisma.refundRecord.update({
        where: { id: recordId },
        data: { finalizedAt: record.finalizedAt ?? new Date() },
      });
    }
    const failSlice = record.slices.find((s) => s.status === 'FAILED');
    return {
      status: 'FAILED',
      refundRecordId: recordId,
      reason: record.failureReason ?? failSlice?.lastReconcileResult ?? 'Refund refused by Stripe',
    };
  }

  if (delta > 0) {
    await applyExecutedDelta(
      record.id,
      ledger,
      ctx,
      record.slices,
      delta,
      record.finalizedExecutedPence
    );
  } else {
    await prisma.booking.updateMany({
      where: { id: bookingId, transferStatus: 'REFUNDING' },
      data: { transferStatus: nextTransferStatus(ledger, ctx) },
    });
  }

  const refundIds = record.slices
    .filter((s) => s.stripeRefundId)
    .map((s) => s.stripeRefundId as string);
  const bookingAfter = await loadBookingLedger(prisma, bookingId);
  const fullyRefunded =
    !!bookingAfter &&
    bookingAfter.chargedPence > 0 &&
    bookingAfter.booking.paymentStatus === 'REFUNDED';
  if (status === 'PARTIAL') {
    return {
      status: 'FAILED',
      code: 'PARTIAL',
      refundRecordId: recordId,
      amountRefunded: executed / 100,
      stripeRefundId: refundIds[0],
      reason: `Partially executed (£${(executed / 100).toFixed(2)}) — retry the remainder`,
    };
  }
  return {
    status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    refundRecordId: recordId,
    stripeRefundId: refundIds[0],
    amountRefunded: executed / 100,
  };
}

function nextTransferStatus(ledger: BookingLedger, ctx: RecordContext): string {
  if (ledger.booking.paymentStatus === 'REFUNDED') return 'REFUNDED';
  return ctx.isPostRelease ? 'RELEASED' : 'PENDING';
}

/**
 * The consequences of newly executed money: transfer state, pre-release
 * earnings scaling (the one cleaner-share formula), the caller's override,
 * Xero per slice, messages and audit. CAS on finalizedExecutedPence so a
 * concurrent finaliser (webhook versus in-line) applies it once.
 */
async function applyExecutedDelta(
  recordId: string,
  ledger: BookingLedger,
  ctx: RecordContext,
  slices: {
    id: string;
    stripePaymentIntentId: string;
    status: string;
    executedPence: number;
    stripeRefundId: string | null;
  }[],
  delta: number,
  /** The finalised total the delta was computed from: the CAS compares to it. */
  finalizedBefore: number
): Promise<void> {
  const bookingId = ledger.booking.id;
  const flaggedPis = new Set(
    ledger.topups.filter((t) => t.flagged).map((t) => t.stripePaymentIntentId)
  );
  const shareableExecuted = slices
    .filter((s) => s.status === 'SUCCEEDED' && !flaggedPis.has(s.stripePaymentIntentId))
    .reduce((sum, s) => sum + s.executedPence, 0);
  const shareableDelta = shareableExecuted - (ctx.finalizedShareablePence ?? 0);
  const fullyRefunded = ledger.booking.paymentStatus === 'REFUNDED';

  const bookingUpdate: Record<string, unknown> = {
    ...(ctx.bookingDataOverride ?? {}),
    transferStatus: nextTransferStatus(ledger, ctx),
  };
  if (!ctx.isPostRelease && ctx.adjustEarnings) {
    const earningsPence = toPence(ledger.booking.cleanerEarnings);
    if (fullyRefunded) {
      bookingUpdate.cleanerEarnings = 0;
      bookingUpdate.platformFee = 0;
      if (ledger.booking.cleanerPayoutAmount !== null) bookingUpdate.cleanerPayoutAmount = 0;
      if (ledger.booking.platformCommissionAmount !== null)
        bookingUpdate.platformCommissionAmount = 0;
    } else if (shareableDelta > 0) {
      // remainingShareable now excludes this delta; before it, it included it.
      const before = remainingShareablePence(ledger) + shareableDelta;
      const share = cleanerSharePence({
        cleanerRemainingPence: earningsPence,
        remainingShareablePence: before,
        refundShareablePence: shareableDelta,
      });
      const factor = before > 0 ? 1 - shareableDelta / before : 0;
      const scale = (v: unknown) =>
        v === null || v === undefined
          ? undefined
          : Math.max(0, Math.round(Number(v) * factor * 100) / 100);
      bookingUpdate.cleanerEarnings = Math.max(0, (earningsPence - share) / 100);
      bookingUpdate.platformFee = scale(ledger.booking.platformFee);
      const payout = scale(ledger.booking.cleanerPayoutAmount);
      if (payout !== undefined) bookingUpdate.cleanerPayoutAmount = payout;
      const commission = scale(ledger.booking.platformCommissionAmount);
      if (commission !== undefined) bookingUpdate.platformCommissionAmount = commission;
    }
  }

  const nextCtx: RecordContext = {
    ...ctx,
    finalizedShareablePence: shareableExecuted,
    xeroSliceIds: Array.from(
      new Set([
        ...(ctx.xeroSliceIds ?? []),
        ...slices.filter((s) => s.status === 'SUCCEEDED').map((s) => s.id),
      ])
    ),
  };
  const won = await prisma.$transaction(async (tx) => {
    const claim = await tx.refundRecord.updateMany({
      where: { id: recordId, finalizedExecutedPence: finalizedBefore },
      data: {
        finalizedExecutedPence: finalizedBefore + delta,
        finalizedAt: new Date(),
        context: nextCtx as unknown as Prisma.InputJsonValue,
        failureReason: null,
      },
    });
    if (claim.count !== 1) return false;
    await tx.booking.updateMany({
      where: { id: bookingId, transferStatus: 'REFUNDING' },
      data: bookingUpdate,
    });
    return true;
  });
  if (!won) return;

  // Xero: one reversing transaction per newly executed slice, with its own
  // cleaner portion (shareable slices only). Idempotent per stripeRefundId.
  const newSlices = slices.filter(
    (s) => s.status === 'SUCCEEDED' && !(ctx.xeroSliceIds ?? []).includes(s.id) && s.stripeRefundId
  );
  for (const s of newSlices) {
    const portion =
      flaggedPis.has(s.stripePaymentIntentId) || shareableDelta <= 0
        ? 0
        : ctx.isPostRelease
          ? Math.round((ctx.reversalTargetPence * s.executedPence) / Math.max(1, shareableExecuted))
          : Math.round(
              (toPence(ledger.booking.cleanerEarnings) * s.executedPence) /
                Math.max(1, remainingShareablePence(ledger) + shareableDelta)
            );
    await enqueueXeroPush({
      bookingId,
      event: 'REFUND',
      externalRef: s.stripeRefundId as string,
      isPostRelease: ctx.isPostRelease,
      refundAmount: s.executedPence / 100,
      cleanerRefundPortion: portion / 100,
      occurredAt: new Date().toISOString(),
    }).catch(() => {});
  }

  const amount = delta / 100;
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, cleanerId: true, date: true },
  });
  if (b)
    await notifyRefundSuccess({ id: bookingId, ...b }, amount, ctx.reason, fullyRefunded).catch(
      () => {}
    );
  if (ctx.late) {
    const { sendRefundConfirmationForBooking } = await import('./email.service');
    await sendRefundConfirmationForBooking(bookingId, amount, fullyRefunded).catch(() => {});
  }
  await AuditService.log({
    userId: ctx.triggeredBy,
    action: 'PAYMENT_REFUNDED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      amount,
      reason: ctx.reason,
      refundRecordId: recordId,
      stripeRefundIds: newSlices.map((s) => s.stripeRefundId),
      isFullRefund: fullyRefunded,
      isPostRelease: ctx.isPostRelease,
    },
  }).catch(() => {});
}

// ─── Retry the remainder of a FAILED or PARTIAL record (stuck-money) ────

export async function retryRefundRemainder(
  recordId: string,
  actorId?: string
): Promise<RefundResult> {
  // Read Stripe first: a slice that actually landed is recorded, never re-sent.
  await reconcileRecordSlices(recordId);
  const record = await prisma.refundRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { slices: true },
  });
  if (record.slices.some((s) => isUnresolved(s.status) || s.status === 'PENDING')) {
    return {
      status: 'FAILED',
      code: LEDGER_RECONCILIATION_PENDING,
      reason: 'Still reconciling with Stripe',
    };
  }
  if (record.status !== 'FAILED' && record.status !== 'PARTIAL') {
    return { status: 'SKIPPED', refundRecordId: recordId, reason: `Record is ${record.status}` };
  }
  const requested = record.requestedPence ?? toPence(record.amount);
  const remainder = requested - record.executedPence;
  if (remainder <= 0)
    return { status: 'SKIPPED', refundRecordId: recordId, reason: 'Nothing left' };

  const ledger = await loadBookingLedger(prisma, record.bookingId);
  if (!ledger) return { status: 'FAILED', reason: 'Booking not found' };
  const ctx = record.context as unknown as RecordContext;
  const claimable = ctx.isPostRelease
    ? ['RELEASED', 'REFUNDING']
    : ['PENDING', 'FAILED', 'PAUSED', 'REFUNDING'];
  const claimed = await prisma.booking.updateMany({
    where: { id: record.bookingId, transferStatus: { in: claimable } },
    data: { transferStatus: 'REFUNDING' },
  });
  if (claimed.count === 0) return { status: 'SKIPPED', reason: 'Another operation is in progress' };

  const plan = allocateRefund(chargesLifo(ledger), remainder);
  if (plan.shortfallPence > 0) {
    await prisma.booking.updateMany({
      where: { id: record.bookingId, transferStatus: 'REFUNDING' },
      data: { transferStatus: ctx.prevTransferStatus },
    });
    return { status: 'FAILED', reason: 'The remainder does not fit the charges on this booking' };
  }
  await prisma.refundRecord.update({
    where: { id: recordId },
    data: {
      finalizedAt: null,
      context: { ...ctx, late: true } as unknown as Prisma.InputJsonValue,
    },
  });
  await AuditService.log({
    userId: actorId,
    action: 'REFUND_REMAINDER_RETRIED',
    entityType: 'Booking',
    entityId: record.bookingId,
    metadata: { refundRecordId: recordId, remainderPence: remainder },
  }).catch(() => {});
  return runRecord(recordId, record.bookingId, plan.slices, record.attempt + 1);
}

// ─── Reconciliation (read Stripe, write the truth) ─────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One refund slice: by its stored refund id, or by listing its payment
 * intent's refunds and matching metadata (refundSliceId, or the legacy
 * refundRecordId). Absent after 24h with no refund on the intent: FAILED.
 * Returns the slice's status afterwards.
 */
export async function reconcileRefundSlice(sliceId: string): Promise<string> {
  const slice = await prisma.refundSlice.findUniqueOrThrow({
    where: { id: sliceId },
    include: { record: { select: { bookingId: true, createdAt: true } } },
  });
  if (!['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'].includes(slice.status)) return slice.status;
  const bookingId = slice.record.bookingId;
  try {
    let found: { id: string; amount: number; status: string | null } | null = null;
    // Refunds on the intent that no slice claims: their presence forbids the
    // 24h FAILED conclusion (never guessed; an admin matches them).
    let unclaimed = 0;
    if (slice.stripeRefundId) {
      found = await stripe.refunds.retrieve(slice.stripeRefundId);
    } else {
      const list = await stripe.refunds.list({
        payment_intent: slice.stripePaymentIntentId,
        limit: 100,
      });
      const live = list.data.filter((r) => r.status !== 'failed' && r.status !== 'canceled');
      if (live.length > 0) {
        const claimedIds = await prisma.refundSlice.findMany({
          where: { stripeRefundId: { in: live.map((r) => r.id) } },
          select: { stripeRefundId: true },
        });
        const claimedSet = new Set(claimedIds.map((c) => c.stripeRefundId));
        unclaimed = live.filter((r) => !claimedSet.has(r.id)).length;
      }
      found =
        list.data.find((r) => r.metadata?.refundSliceId === slice.id) ??
        // Legacy slices: one refund per record per payment intent.
        list.data.find(
          (r) =>
            r.metadata?.refundRecordId === slice.refundRecordId &&
            !r.metadata?.refundSliceId &&
            (slice.requestedPence === 0 || r.amount === slice.requestedPence)
        ) ??
        null;
      if (found) {
        // A refund id already attached to another slice is not this one.
        const taken = await prisma.refundSlice.findFirst({
          where: { stripeRefundId: found.id, id: { not: slice.id } },
          select: { id: true },
        });
        if (taken) found = null;
      }
    }
    if (found) {
      const outcome = await writeSliceFromRefund(slice.id, bookingId, found);
      if (outcome === 'PENDING')
        await bumpSliceRetry(slice.id, slice.retryCount, 'stripe refund still pending');
      await finalizeAfterReconcile(slice.refundRecordId);
      return outcome;
    }
    const age = Date.now() - slice.record.createdAt.getTime();
    if (age > DAY_MS && unclaimed > 0) {
      await prisma.refundSlice.updateMany({
        where: { id: slice.id, status: { in: ['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'] } },
        data: { status: 'NEEDS_RECONCILE' },
      });
      await bumpSliceRetry(
        slice.id,
        slice.retryCount,
        `${unclaimed} unmatched refund(s) on the payment intent; needs an admin match`
      );
      return 'NEEDS_RECONCILE';
    }
    if (age > DAY_MS) {
      await prisma.$transaction(async (tx) => {
        await tx.refundSlice.updateMany({
          where: { id: slice.id, status: { in: ['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'] } },
          data: {
            status: 'FAILED',
            lastReconciledAt: new Date(),
            lastReconcileResult: 'no refund on the payment intent after 24h',
          },
        });
        await recomputeRefundRecord(tx, slice.refundRecordId);
        await recomputeBookingRefundState(tx, bookingId);
      });
      await finalizeAfterReconcile(slice.refundRecordId);
      return 'FAILED';
    }
    await bumpSliceRetry(slice.id, slice.retryCount, 'no matching refund yet');
    return slice.status;
  } catch (err) {
    await bumpSliceRetry(
      slice.id,
      slice.retryCount,
      `stripe read failed: ${err instanceof Error ? err.message : 'error'}`
    );
    return slice.status;
  }
}

async function bumpSliceRetry(sliceId: string, retryCount: number, result: string): Promise<void> {
  await prisma.refundSlice.update({
    where: { id: sliceId },
    data: {
      retryCount: retryCount + 1,
      nextRetryAt: nextRetryAt(new Date(), retryCount + 1),
      lastReconciledAt: new Date(),
      lastReconcileResult: result,
    },
  });
}

async function finalizeAfterReconcile(recordId: string): Promise<void> {
  const rec = await prisma.refundRecord.findUnique({
    where: { id: recordId },
    select: { context: true, slices: { select: { status: true } } },
  });
  if (!rec || rec.slices.some((s) => isUnresolved(s.status) || s.status === 'PENDING')) return;
  if (rec.context) {
    const ctx = rec.context as unknown as RecordContext;
    if (!ctx.late) {
      await prisma.refundRecord.update({
        where: { id: recordId },
        data: { context: { ...ctx, late: true } as unknown as Prisma.InputJsonValue },
      });
    }
    await finalizeRefundRecord(recordId);
  } else {
    // A migrated legacy record: its money was finalised by the old code. The
    // record status and the booking state are recomputed; nothing else runs.
    const executed = await prisma.$transaction(async (tx) => {
      await recomputeRefundRecord(tx, recordId);
      const r = await tx.refundRecord.findUniqueOrThrow({
        where: { id: recordId },
        select: { bookingId: true, executedPence: true },
      });
      await recomputeBookingRefundState(tx, r.bookingId);
      return r.executedPence;
    });
    await prisma.refundRecord.update({
      where: { id: recordId },
      data: { finalizedExecutedPence: executed, finalizedAt: new Date() },
    });
  }
}

/** Every unresolved slice of one record (the stuck-money Reconcile action). */
export async function reconcileRecordSlices(recordId: string): Promise<void> {
  const slices = await prisma.refundSlice.findMany({
    where: { refundRecordId: recordId, status: { in: ['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'] } },
    select: { id: true },
  });
  for (const s of slices) await reconcileRefundSlice(s.id);
}

/** An UNKNOWN reversal: list the transfer's reversals and match the row's metadata. */
export async function reconcileReversal(rowId: string): Promise<string> {
  const row = await prisma.transferReversal.findUniqueOrThrow({
    where: { id: rowId },
    include: { slice: true },
  });
  if (row.status !== 'UNKNOWN' && row.status !== 'PENDING') return row.status;
  try {
    const list = await stripe.transfers.listReversals(row.slice.stripeTransferId, { limit: 100 });
    const found = list.data.find((r) => r.metadata?.transferReversalId === row.id);
    if (found) {
      await confirmReversal(row.id, { id: found.id, amount: found.amount });
      await afterReversalSettled(row.refundRecordId);
      return 'SUCCEEDED';
    }
    if (Date.now() - row.createdAt.getTime() > DAY_MS) {
      await prisma.transferReversal.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          lastReconciledAt: new Date(),
          lastReconcileResult: 'no reversal after 24h',
        },
      });
      await afterReversalSettled(row.refundRecordId);
      return 'FAILED';
    }
    await prisma.transferReversal.update({
      where: { id: row.id },
      data: {
        retryCount: row.retryCount + 1,
        nextRetryAt: nextRetryAt(new Date(), row.retryCount + 1),
        lastReconciledAt: new Date(),
        lastReconcileResult: 'no matching reversal yet',
      },
    });
    return row.status;
  } catch (err) {
    await prisma.transferReversal.update({
      where: { id: row.id },
      data: {
        retryCount: row.retryCount + 1,
        nextRetryAt: nextRetryAt(new Date(), row.retryCount + 1),
        lastReconcileResult: `stripe read failed: ${err instanceof Error ? err.message : 'error'}`,
      },
    });
    return row.status;
  }
}

/**
 * A record that stopped at an unknown reversal never sent its refund slices.
 * Once every reversal of it is settled, the record becomes FAILED so the
 * stuck-money "Retry remainder" can continue it (the settled reversal counts;
 * the refund is sent then, never automatically). The booking stays REFUNDING.
 */
async function afterReversalSettled(recordId: string): Promise<void> {
  const open = await prisma.transferReversal.count({
    where: { refundRecordId: recordId, status: { in: ['UNKNOWN', 'PENDING'] } },
  });
  if (open > 0) return;
  const slices = await prisma.refundSlice.count({ where: { refundRecordId: recordId } });
  if (slices > 0) return;
  await prisma.refundRecord.updateMany({
    where: { id: recordId, status: 'UNKNOWN' },
    data: {
      status: 'FAILED',
      failureReason: 'The reversal is settled; the refund was not sent. Retry the remainder.',
      finalizedAt: new Date(),
    },
  });
}

// ─── charge.refunded (RENA-011) ────────────────────────────

/**
 * The webhook never judges the booking from one charge: each refund on the
 * charge confirms its slice (by refund id or metadata), or, when no slice
 * matches, is recorded as a STRIPE_DASHBOARD refund with one SUCCEEDED slice.
 * Then the booking state is recomputed from every slice. A duplicate event
 * changes nothing (guarded updates; the unique refund id).
 */
export async function handleChargeRefunded(charge: {
  id: string;
  payment_intent: string | { id: string } | null;
  refunds?: {
    data: {
      id: string;
      amount: number;
      status: string | null;
      metadata?: Record<string, string> | null;
    }[];
  } | null;
}): Promise<void> {
  const booking =
    (await prisma.booking.findUnique({
      where: { stripeChargeId: charge.id },
      select: { id: true },
    })) ??
    (await prisma.topupRecord
      .findUnique({ where: { stripeChargeId: charge.id }, select: { bookingId: true } })
      .then((t) => (t ? { id: t.bookingId } : null)));
  if (!booking) return;
  const piId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  const refunds =
    charge.refunds?.data ?? (await stripe.refunds.list({ charge: charge.id, limit: 100 })).data;

  for (const r of refunds) {
    if (r.status !== 'succeeded') continue;
    const slice =
      (await prisma.refundSlice.findUnique({
        where: { stripeRefundId: r.id },
        select: { id: true },
      })) ??
      (r.metadata?.refundSliceId
        ? await prisma.refundSlice.findUnique({
            where: { id: r.metadata.refundSliceId },
            select: { id: true },
          })
        : null);
    if (slice) {
      await writeSliceFromRefund(slice.id, booking.id, r);
      const rec = await prisma.refundSlice.findUniqueOrThrow({
        where: { id: slice.id },
        select: { refundRecordId: true },
      });
      await finalizeAfterReconcile(rec.refundRecordId);
      continue;
    }
    if (r.metadata?.refundRecordId) continue; // ours, matched by the reconciler
    // A refund issued outside Rena (the Stripe dashboard).
    try {
      await prisma.$transaction(async (tx) => {
        const rec = await tx.refundRecord.create({
          data: {
            bookingId: booking.id,
            amount: r.amount / 100,
            requestedPence: r.amount,
            executedPence: r.amount,
            reason: 'Refund issued in the Stripe dashboard',
            triggeredBy: 'STRIPE_DASHBOARD',
            status: 'SUCCEEDED',
            stripeRefundId: r.id,
            finalizedExecutedPence: r.amount,
            finalizedAt: new Date(),
          },
        });
        await tx.refundSlice.create({
          data: {
            refundRecordId: rec.id,
            stripePaymentIntentId: piId ?? '',
            stripeChargeId: charge.id,
            requestedPence: r.amount,
            executedPence: r.amount,
            stripeRefundId: r.id,
            status: 'SUCCEEDED',
            idempotencyKey: `dashboard_${r.id}`,
            lastReconcileResult: 'recorded from charge.refunded',
          },
        });
        await recomputeBookingRefundState(tx, booking.id);
      });
      log.warn('refund', 'dashboard_refund_recorded', { bookingId: booking.id });
    } catch (err) {
      // P2002 on the refund id: already recorded (a duplicate event).
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  await prisma.$transaction((tx) => recomputeBookingRefundState(tx, booking.id));
}

/** The cleaner's share of a chargeback or refund amount (Xero, the dispute webhook). */
export async function cleanerShareForAmountPence(
  bookingId: string,
  amountPence: number
): Promise<number> {
  const ledger = await loadBookingLedger(prisma, bookingId);
  if (!ledger) return 0;
  const released = ledger.booking.transferStatus === 'RELEASED';
  const cleanerRemaining = released
    ? ledger.transferSlices.reduce(
        (s, t) => s + Math.max(0, (t.amountPence ?? 0) - t.reversedPence),
        0
      )
    : toPence(ledger.booking.cleanerEarnings);
  return cleanerSharePence({
    cleanerRemainingPence: cleanerRemaining,
    remainingShareablePence: remainingShareablePence(ledger),
    refundShareablePence: amountPence,
  });
}

/** What can still be refunded on a booking, or null while reconciling. */
export async function remainingRefundableFor(bookingId: string): Promise<number | null> {
  const ledger = await loadBookingLedger(prisma, bookingId);
  if (!ledger) return 0;
  return remainingRefundablePence(ledger.chargedPence, ledger.slices);
}

// ─── Notifications (best-effort) ───────────────────────────

async function notifyRefundSuccess(
  booking: { id: string; clientId: string | null; cleanerId: string; date: Date },
  amount: number,
  reason: string,
  isFullRefund: boolean
): Promise<void> {
  const dateStr = booking.date.toLocaleDateString('en-GB');
  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'SYSTEM',
          title: isFullRefund ? 'Full refund issued' : 'Partial refund issued',
          body: `A refund of £${amount.toFixed(2)} has been issued for ${dateStr}. ${reason}`,
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
  }
  if (booking.cleanerId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.cleanerId,
          type: 'SYSTEM',
          title: 'Booking refund issued',
          body: `A refund has been issued for a booking on ${dateStr}.`,
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
  }
}

/**
 * Scheduler (D-ac): read-only reconciliation of unresolved refund slices and
 * reversals whose backoff has passed, oldest first. Never executes money; a
 * PENDING row is only read once it is ten minutes old (a live worker owns it
 * before that). Persistent failures stay listed in stuck-money.
 */
export async function reconcileUnresolvedRefunds(limit = 50): Promise<{ processed: number }> {
  const now = new Date();
  const stale = new Date(now.getTime() - 10 * 60_000);
  const due = { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] };
  const slices = await prisma.refundSlice.findMany({
    where: {
      AND: [
        due,
        {
          OR: [
            { status: { in: ['UNKNOWN', 'NEEDS_RECONCILE'] } },
            { status: 'PENDING', createdAt: { lt: stale } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: limit,
  });
  let processed = 0;
  for (const s of slices) {
    try {
      const status = await reconcileRefundSlice(s.id);
      if (status === 'SUCCEEDED' || status === 'FAILED') processed++;
    } catch (err) {
      log.error('refund', 'slice_reconcile_threw', { refundSliceId: s.id }, err);
    }
  }
  const reversals = await prisma.transferReversal.findMany({
    where: {
      AND: [
        due,
        {
          OR: [{ status: 'UNKNOWN' }, { status: 'PENDING', createdAt: { lt: stale } }],
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: limit,
  });
  for (const r of reversals) {
    try {
      const status = await reconcileReversal(r.id);
      if (status === 'SUCCEEDED' || status === 'FAILED') processed++;
    } catch (err) {
      log.error('refund', 'reversal_reconcile_threw', { transferReversalId: r.id }, err);
    }
  }
  return { processed };
}

/**
 * Stuck-money "Reconcile" on a booking stuck REFUNDING: read Stripe for every
 * unresolved slice and reversal, then settle records a crash interrupted
 * before any Stripe call (no slices, no open reversal): FAILED with the claim
 * released when nothing moved, FAILED with the claim kept when a reversal
 * landed (the admin retries the remainder). Never sends money.
 */
export async function recoverStaleRefunding(
  bookingId: string
): Promise<{ transferStatus: string | null }> {
  const records = await prisma.refundRecord.findMany({
    where: { bookingId },
    select: { id: true },
  });
  for (const r of records) {
    await reconcileRecordSlices(r.id);
    const open = await prisma.transferReversal.findMany({
      where: { refundRecordId: r.id, status: { in: ['UNKNOWN', 'PENDING'] } },
      select: { id: true },
    });
    for (const v of open) await reconcileReversal(v.id);
  }
  const stale = new Date(Date.now() - 10 * 60_000);
  const interrupted = await prisma.refundRecord.findMany({
    where: {
      bookingId,
      status: { in: ['PENDING', 'UNKNOWN'] },
      createdAt: { lt: stale },
      slices: { none: {} },
    },
  });
  for (const rec of interrupted) {
    if (!rec.context) continue;
    const openReversals = await prisma.transferReversal.count({
      where: { refundRecordId: rec.id, status: { in: ['UNKNOWN', 'PENDING'] } },
    });
    if (openReversals > 0) continue;
    const reversed = await reversedForRecord(rec.id);
    const ctx = rec.context as unknown as RecordContext;
    await prisma.refundRecord.updateMany({
      where: { id: rec.id, status: { in: ['PENDING', 'UNKNOWN'] } },
      data: {
        status: 'FAILED',
        failureReason:
          reversed > 0
            ? 'Interrupted after the reversal; the refund was not sent. Retry the remainder.'
            : 'Interrupted before any money moved',
        finalizedAt: new Date(),
      },
    });
    if (reversed === 0) {
      await prisma.booking.updateMany({
        where: { id: bookingId, transferStatus: 'REFUNDING' },
        data: { transferStatus: ctx.prevTransferStatus },
      });
    }
    log.warn('refund', 'interrupted_record_settled', { bookingId, refundRecordId: rec.id });
  }
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { transferStatus: true },
  });
  return { transferStatus: b?.transferStatus ?? null };
}

/**
 * Stuck-money "Refund top-up" (B3 R2, B4): refund a TOPUP_WITHOUT_ASSIGNMENT
 * charge on its own payment intent, never touching the original charge or
 * the cleaner's earnings (a flagged top-up carries no share).
 */
export async function refundFlaggedTopup(
  topupRecordId: string,
  actorId: string
): Promise<RefundResult> {
  const t = await prisma.topupRecord.findUnique({ where: { id: topupRecordId } });
  if (
    !t ||
    t.status !== 'SUCCEEDED' ||
    !t.stripePaymentIntentId ||
    !(t.failureReason ?? '').startsWith(`${TOPUP_WITHOUT_ASSIGNMENT}:`)
  ) {
    return { status: 'SKIPPED', reason: 'Not an unrefunded top-up without assignment' };
  }
  const ledger = await loadBookingLedger(prisma, t.bookingId);
  if (!ledger) return { status: 'FAILED', reason: 'Booking not found' };
  const charge = chargesLifo(ledger).find((c) => c.paymentIntentId === t.stripePaymentIntentId);
  const remaining = charge ? Math.max(0, charge.capturedPence - charge.takenPence) : 0;
  if (remaining <= 0) return { status: 'SKIPPED', reason: 'Nothing left on this top-up' };

  const result = await refundBooking(
    t.bookingId,
    remaining / 100,
    'Top-up refunded: the reassignment did not go ahead',
    { triggeredBy: actorId, adjustEarnings: false, onlyPaymentIntentId: t.stripePaymentIntentId }
  );
  if (result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED') {
    // The flag prefix stays (the share maths keys on it); the queue no longer lists it.
    await prisma.topupRecord.updateMany({
      where: { id: t.id, failureReason: { startsWith: `${TOPUP_WITHOUT_ASSIGNMENT}:` } },
      data: {
        failureReason: `${TOPUP_WITHOUT_ASSIGNMENT}_REFUNDED${(t.failureReason ?? '').slice(TOPUP_WITHOUT_ASSIGNMENT.length)}`,
      },
    });
    await AuditService.log({
      userId: actorId,
      action: 'TOPUP_WITHOUT_ASSIGNMENT_REFUNDED',
      entityType: 'Booking',
      entityId: t.bookingId,
      metadata: {
        topupRecordId: t.id,
        amountPence: remaining,
        refundRecordId: result.refundRecordId,
      },
    }).catch(() => {});
  }
  return result;
}
