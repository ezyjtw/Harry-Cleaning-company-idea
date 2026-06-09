// ─── A5.2 Refund Foundation ───────────────────────────────────
//
// Single owner of all refund money movement. Every refund path calls
// refundBooking() — no other code calls stripe.refunds.create().
// Mirrors releaseBookingFunds() as the single release owner.
//
// REQUIRED FOLLOW-UP (before production): admin surface listing
// RefundRecords with status REVERSAL_ONLY or UNKNOWN. These states
// mean "admin must investigate" but nothing surfaces them yet.
// The @@index([status]) on RefundRecord makes querying fast.

import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';

// ─── Types ─────────────────────────────────────────────────

export interface RefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED' | 'SKIPPED';
  refundRecordId?: string;
  stripeRefundId?: string;
  amountRefunded?: number;
  reason?: string;
}

interface RefundOptions {
  triggeredBy?: string;
  adjustEarnings?: boolean;
}

// ─── Error Classification ─────────────────────────────────
//
// Identical to transfer.service.ts — same Stripe error types.
//
// Unknown-outcome (MUST NOT bump attempt — preserves idempotency key):
//   StripeConnectionError — ETIMEDOUT, ECONNRESET, DNS failures
//   StripeAPIError        — Stripe 500/502/503/504; server may have processed
//
// Definitive (safe to bump attempt — new idempotency key on next retry):
//   StripeInvalidRequestError, StripeCardError, StripeAuthenticationError,
//   StripePermissionError, StripeRateLimitError, StripeIdempotencyError

function isUnknownOutcome(err: unknown): boolean {
  if (err && typeof err === 'object' && 'type' in err) {
    const stripeErr = err as { type: string };
    return stripeErr.type === 'StripeConnectionError' || stripeErr.type === 'StripeAPIError';
  }
  return false;
}

// ─── Service ───────────────────────────────────────────────

export async function refundBooking(
  bookingId: string,
  amountPounds: number,
  reason: string,
  options: RefundOptions = {}
): Promise<RefundResult> {
  const { triggeredBy, adjustEarnings = true } = options;

  // 1. Load booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      refundRecords: { where: { status: 'SUCCEEDED' } },
      client: { select: { id: true } },
    },
  });

  if (!booking) return { status: 'FAILED', reason: 'Booking not found' };

  // 2. Payment guards
  if (!booking.stripePaymentIntentId) {
    return { status: 'FAILED', reason: 'No payment intent on booking' };
  }
  if (booking.paymentStatus !== 'SUCCEEDED' && booking.paymentStatus !== 'PARTIALLY_REFUNDED') {
    return {
      status: 'FAILED',
      reason: `Cannot refund — payment status is ${booking.paymentStatus}`,
    };
  }

  // 3. Amount guards
  const totalPaid = Number(booking.totalPrice);
  const alreadyRefunded = booking.refundRecords.reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = totalPaid - alreadyRefunded;

  if (amountPounds <= 0) {
    return { status: 'FAILED', reason: 'Refund amount must be positive' };
  }
  if (amountPounds > refundable + 0.01) {
    return {
      status: 'FAILED',
      reason: `Refund £${amountPounds.toFixed(2)} exceeds refundable £${refundable.toFixed(2)}`,
    };
  }

  const isFullRefund = Math.abs(amountPounds - refundable) < 0.01;
  const amountPence = Math.round(amountPounds * 100);

  // 4. Transfer status guards
  if (booking.transferStatus === 'RELEASING' || booking.transferStatus === 'UNKNOWN') {
    return { status: 'FAILED', reason: 'Transfer in flight — retry later' };
  }
  if (booking.transferStatus === 'REFUNDED') {
    return { status: 'SKIPPED', reason: 'Booking already fully refunded' };
  }

  const isPostRelease = booking.transferStatus === 'RELEASED';
  const prevTransferStatus = booking.transferStatus;

  // 5. Create RefundRecord (PENDING)
  const refundRecord = await prisma.refundRecord.create({
    data: { bookingId, amount: amountPounds, reason, triggeredBy, status: 'PENDING' },
  });

  // 6. Atomic claim — mutual exclusion with releaseBookingFunds.
  //    REFUNDING is not in release's claim set {PENDING, UNKNOWN, FAILED, RELEASING}.
  const claimableStates = isPostRelease ? ['RELEASED'] : ['PENDING', 'FAILED'];
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: { in: claimableStates } },
    data: { transferStatus: 'REFUNDING' },
  });

  if (claimed.count === 0) {
    await prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: { status: 'FAILED', failureReason: 'Could not acquire lock' },
    });
    return { status: 'SKIPPED', reason: 'Another operation is in progress' };
  }

  // 7. Post-release: reverse cleaner's share with idempotency protection.
  //    KNOWN EXPOSURE: if cleaner has withdrawn, reversal creates negative
  //    balance on their Connect account. Rena liable for deficit.
  //    Future mitigation: payout hold period.
  let reversalSucceeded = false;
  if (isPostRelease && booking.stripeTransferId) {
    const cleanerSharePence = calculateCleanerSharePence(amountPounds, booking);
    if (cleanerSharePence > 0) {
      const reversalResult = await executeReversal(
        booking.stripeTransferId,
        cleanerSharePence,
        refundRecord,
        bookingId,
        prevTransferStatus
      );
      if (!reversalResult.success) {
        return {
          status: 'FAILED',
          refundRecordId: refundRecord.id,
          reason: reversalResult.reason,
        };
      }
      reversalSucceeded = true;
    }
  }

  // 8. Create Stripe refund
  const attempt = refundRecord.attempt + 1;
  const idempotencyKey = `refund_${refundRecord.id}_v${attempt}`;

  try {
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: booking.stripePaymentIntentId,
        amount: amountPence,
        metadata: { bookingId, refundRecordId: refundRecord.id },
      },
      { idempotencyKey }
    );

    await writeRefundSuccess({
      booking,
      refundRecord,
      stripeRefundId: stripeRefund.id,
      amountPounds,
      isFullRefund,
      isPostRelease,
      prevTransferStatus,
      attempt,
      adjustEarnings,
    });

    await notifyRefundSuccess(booking, amountPounds, reason, isFullRefund).catch(() => {});
    await logRefundAudit(
      bookingId,
      amountPounds,
      reason,
      stripeRefund.id,
      isFullRefund,
      isPostRelease,
      triggeredBy
    ).catch(() => {});

    return {
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundRecordId: refundRecord.id,
      stripeRefundId: stripeRefund.id,
      amountRefunded: amountPounds,
    };
  } catch (err: unknown) {
    if (isUnknownOutcome(err)) {
      return handleUnknownRefund(
        booking,
        refundRecord,
        amountPounds,
        amountPence,
        isFullRefund,
        isPostRelease,
        prevTransferStatus,
        attempt,
        idempotencyKey,
        reason,
        adjustEarnings
      );
    }

    // Definitive refund failure
    if (reversalSucceeded) {
      // Reversal clawed back from cleaner but customer refund failed.
      // Money sits on platform — admin must retry refund or reverse the reversal.
      // Keep REFUNDING so release can't re-pay cleaner.
      await prisma.refundRecord.update({
        where: { id: refundRecord.id },
        data: {
          status: 'REVERSAL_ONLY',
          attempt,
          failureReason: `Reversal succeeded but refund failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      });
      return {
        status: 'FAILED',
        refundRecordId: refundRecord.id,
        reason: 'Transfer reversed but customer refund failed — admin intervention required',
      };
    }

    // Pre-release or no reversal needed — safe to release claim
    const failReason = err instanceof Error ? err.message : 'Unknown Stripe error';
    await prisma.$transaction([
      prisma.refundRecord.update({
        where: { id: refundRecord.id },
        data: { status: 'FAILED', attempt, failureReason: failReason },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { transferStatus: prevTransferStatus },
      }),
    ]);
    return { status: 'FAILED', refundRecordId: refundRecord.id, reason: failReason };
  }
}

// ─── Transfer reversal with idempotency ────────────────────
// Same isUnknownOutcome split as refunds. On unknown: keep REFUNDING,
// mark UNKNOWN, admin investigates. No blind retry, no double-reversal.

interface ReversalResult {
  success: boolean;
  reason?: string;
}

async function executeReversal(
  stripeTransferId: string,
  amountPence: number,
  refundRecord: { id: string; attempt: number },
  bookingId: string,
  prevTransferStatus: string
): Promise<ReversalResult> {
  const attempt = refundRecord.attempt + 1;
  const idempotencyKey = `reversal_${refundRecord.id}_v${attempt}`;

  try {
    await stripe.transfers.createReversal(
      stripeTransferId,
      { amount: amountPence, metadata: { bookingId, refundRecordId: refundRecord.id } },
      { idempotencyKey }
    );
    return { success: true };
  } catch (err: unknown) {
    if (isUnknownOutcome(err)) {
      // Same-key retry
      try {
        await stripe.transfers.createReversal(
          stripeTransferId,
          { amount: amountPence, metadata: { bookingId, refundRecordId: refundRecord.id } },
          { idempotencyKey }
        );
        return { success: true };
      } catch {
        // Still unknown — keep REFUNDING, mark UNKNOWN, admin investigates
        await prisma.refundRecord.update({
          where: { id: refundRecord.id },
          data: {
            status: 'UNKNOWN',
            failureReason: 'Transfer reversal outcome unknown — manual check required',
          },
        });
        return {
          success: false,
          reason: 'Transfer reversal outcome unknown — manual check required',
        };
      }
    }

    // Definitive reversal failure — release claim, mark FAILED
    const failReason = err instanceof Error ? err.message : 'Transfer reversal failed';
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { transferStatus: prevTransferStatus },
      }),
      prisma.refundRecord.update({
        where: { id: refundRecord.id },
        data: { status: 'FAILED', failureReason: failReason },
      }),
    ]);
    return { success: false, reason: failReason };
  }
}

// ─── Unknown-outcome retry for refund ──────────────────────
// Same-key retry: Stripe returns original if processed, or processes fresh.
// If retry also fails: keep REFUNDING (blocks release), mark UNKNOWN.

async function handleUnknownRefund(
  booking: {
    id: string;
    stripePaymentIntentId: string | null;
    totalPrice: unknown;
    cleanerEarnings: unknown;
    platformFee: unknown;
    payment: { id: string } | null;
    refundRecords: { amount: unknown }[];
    clientId?: string | null;
    cleanerId?: string;
    date?: Date;
  },
  refundRecord: { id: string; attempt: number },
  amountPounds: number,
  amountPence: number,
  isFullRefund: boolean,
  isPostRelease: boolean,
  prevTransferStatus: string,
  attempt: number,
  idempotencyKey: string,
  reason: string,
  adjustEarnings: boolean
): Promise<RefundResult> {
  try {
    const retryRefund = await stripe.refunds.create(
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        payment_intent: booking.stripePaymentIntentId!,
        amount: amountPence,
        metadata: { bookingId: booking.id, refundRecordId: refundRecord.id },
      },
      { idempotencyKey }
    );

    await writeRefundSuccess({
      booking,
      refundRecord,
      stripeRefundId: retryRefund.id,
      amountPounds,
      isFullRefund,
      isPostRelease,
      prevTransferStatus,
      attempt,
      adjustEarnings,
    });
    await notifyRefundSuccess(booking, amountPounds, reason, isFullRefund).catch(() => {});

    return {
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundRecordId: refundRecord.id,
      stripeRefundId: retryRefund.id,
      amountRefunded: amountPounds,
    };
  } catch {
    // Still unknown — keep REFUNDING (blocks release), don't bump attempt
    await prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: {
        status: 'UNKNOWN',
        failureReason: 'Refund outcome unknown after retry — manual check required',
      },
    });
    return {
      status: 'FAILED',
      refundRecordId: refundRecord.id,
      reason: 'Unknown outcome — refund may have processed. Manual check required.',
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────

function calculateCleanerSharePence(
  refundAmountPounds: number,
  booking: { totalPrice: unknown; cleanerEarnings: unknown }
): number {
  const totalPrice = Number(booking.totalPrice);
  if (totalPrice === 0) return 0;
  const ratio = refundAmountPounds / totalPrice;
  return Math.round(Number(booking.cleanerEarnings) * ratio * 100);
}

interface WriteSuccessParams {
  booking: {
    id: string;
    totalPrice: unknown;
    cleanerEarnings: unknown;
    platformFee: unknown;
    payment: { id: string } | null;
    refundRecords: { amount: unknown }[];
  };
  refundRecord: { id: string };
  stripeRefundId: string;
  amountPounds: number;
  isFullRefund: boolean;
  isPostRelease: boolean;
  prevTransferStatus: string;
  attempt: number;
  adjustEarnings: boolean;
}

async function writeRefundSuccess(params: WriteSuccessParams): Promise<void> {
  const {
    booking,
    refundRecord,
    stripeRefundId,
    amountPounds,
    isFullRefund,
    isPostRelease,
    prevTransferStatus,
    attempt,
    adjustEarnings,
  } = params;

  const isFullPreRelease = isFullRefund && !isPostRelease;

  // transferStatus after refund:
  //   Full (pre or post)   → REFUNDED (terminal)
  //   Partial pre-release  → PENDING (release runs with reduced earnings)
  //   Partial post-release → RELEASED (transfer partially reversed)
  let nextTransferStatus: string;
  if (isFullRefund) {
    nextTransferStatus = 'REFUNDED';
  } else if (isPostRelease) {
    nextTransferStatus = prevTransferStatus;
  } else {
    nextTransferStatus = 'PENDING';
  }

  const bookingUpdate: Record<string, unknown> = {
    paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    transferStatus: nextTransferStatus,
  };

  // Pre-release earnings adjustment — atomic with transferStatus unlock
  // so release never reads stale cleanerEarnings (tightening B).
  if (!isPostRelease && adjustEarnings) {
    const totalPrice = Number(booking.totalPrice);
    const ratio = totalPrice > 0 ? amountPounds / totalPrice : 0;
    if (isFullPreRelease) {
      bookingUpdate.cleanerEarnings = 0;
      bookingUpdate.platformFee = 0;
    } else {
      const earningsReduction = Number(booking.cleanerEarnings) * ratio;
      const feeReduction = Number(booking.platformFee) * ratio;
      bookingUpdate.cleanerEarnings = Math.max(
        0,
        Math.round((Number(booking.cleanerEarnings) - earningsReduction) * 100) / 100
      );
      bookingUpdate.platformFee = Math.max(
        0,
        Math.round((Number(booking.platformFee) - feeReduction) * 100) / 100
      );
    }
  }

  const previouslyRefunded = booking.refundRecords.reduce((sum, r) => sum + Number(r.amount), 0);
  const newRefundTotal = Math.round((previouslyRefunded + amountPounds) * 100) / 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [
    prisma.booking.update({ where: { id: booking.id }, data: bookingUpdate }),
    prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: { stripeRefundId, status: 'SUCCEEDED', attempt, failureReason: null },
    }),
  ];

  if (booking.payment) {
    ops.push(
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundAmount: newRefundTotal,
        },
      })
    );
  }

  await prisma.$transaction(ops);
}

// ─── Notifications (best-effort, fire-and-forget) ──────────

async function notifyRefundSuccess(
  booking: { id: string; clientId?: string | null; cleanerId?: string; date?: Date },
  amount: number,
  reason: string,
  isFullRefund: boolean
): Promise<void> {
  const dateStr = booking.date ? booking.date.toLocaleDateString('en-GB') : 'your booking';

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

async function logRefundAudit(
  bookingId: string,
  amount: number,
  reason: string,
  stripeRefundId: string,
  isFullRefund: boolean,
  isPostRelease: boolean,
  triggeredBy?: string
): Promise<void> {
  await AuditService.log({
    userId: triggeredBy,
    action: 'PAYMENT_REFUNDED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { amount, reason, stripeRefundId, isFullRefund, isPostRelease },
  });
}
