import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

import { getTransferAmountPence } from './transfer-amount';

// ─── Types ─────────────────────────────────────────────────

export interface ReleaseResult {
  status: 'RELEASED' | 'FAILED' | 'ALREADY_RELEASED' | 'SKIPPED';
  transferId?: string;
  reason?: string;
}

// ─── Service ───────────────────────────────────────────────

export async function releaseBookingFunds(bookingId: string): Promise<ReleaseResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      cleaner: {
        include: {
          cleanerProfile: {
            select: {
              stripeAccountId: true,
              stripeChargesEnabled: true,
              stripePayoutsEnabled: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return { status: 'FAILED', reason: 'Booking not found' };
  }

  // Pre-check: skip if already in a terminal transfer state
  if (booking.transferStatus === 'RELEASED') {
    return { status: 'ALREADY_RELEASED', transferId: booking.stripeTransferId ?? undefined };
  }
  if (booking.transferStatus === 'PAUSED' || booking.transferStatus === 'REFUNDED') {
    return { status: 'SKIPPED', reason: `Transfer is ${booking.transferStatus}` };
  }

  if (!booking.stripeChargeId) {
    return fail(
      bookingId,
      booking.transferAttempt,
      'No charge ID on booking — payment may not have succeeded'
    );
  }

  // Account-readiness check
  const profile = booking.cleaner?.cleanerProfile;
  if (!profile?.stripeAccountId) {
    return fail(bookingId, booking.transferAttempt, 'Cleaner has no Stripe Connect account');
  }
  if (!profile.stripeChargesEnabled || !profile.stripePayoutsEnabled) {
    return fail(
      bookingId,
      booking.transferAttempt,
      'Cleaner Connect account not ready: charges or payouts not enabled'
    );
  }

  const transferPence = getTransferAmountPence(Number(booking.cleanerEarnings));
  if (transferPence <= 0) {
    return fail(
      bookingId,
      booking.transferAttempt,
      `Transfer amount is ${transferPence} pence — cannot be zero or negative`
    );
  }

  // Guard: transfer must not exceed the charge amount
  const chargePence = Math.round(Number(booking.totalPrice) * 100);
  if (transferPence > chargePence) {
    return fail(
      bookingId,
      booking.transferAttempt,
      `Transfer ${transferPence}p exceeds charge ${chargePence}p`
    );
  }

  const attempt = booking.transferAttempt + 1;
  const idempotencyKey = `release_${bookingId}_v${attempt}`;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: transferPence,
        currency: 'gbp',
        destination: profile.stripeAccountId,
        source_transaction: booking.stripeChargeId,
        metadata: { bookingId },
      },
      { idempotencyKey }
    );

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        stripeTransferId: transfer.id,
        transferStatus: 'RELEASED',
        transferAttempt: attempt,
        transferFailureReason: null,
      },
    });

    return { status: 'RELEASED', transferId: transfer.id };
  } catch (err: unknown) {
    const isNetworkError = isStripeNetworkError(err);

    if (isNetworkError) {
      // Unknown outcome — the transfer may have been created.
      // Retry with the SAME idempotency key (Stripe returns the original
      // response if it went through, or processes it fresh if it didn't).
      try {
        const retryTransfer = await stripe.transfers.create(
          {
            amount: transferPence,
            currency: 'gbp',
            destination: profile.stripeAccountId,
            source_transaction: booking.stripeChargeId,
            metadata: { bookingId },
          },
          { idempotencyKey }
        );

        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            stripeTransferId: retryTransfer.id,
            transferStatus: 'RELEASED',
            transferAttempt: attempt,
            transferFailureReason: null,
          },
        });

        return { status: 'RELEASED', transferId: retryTransfer.id };
      } catch (retryErr: unknown) {
        const reason = retryErr instanceof Error ? retryErr.message : 'Network retry failed';
        return fail(bookingId, attempt, `Network error + retry failed: ${reason}`);
      }
    }

    // Definitive Stripe error — safe to bump attempt for future retry
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
    return fail(bookingId, attempt, reason);
  }
}

async function fail(bookingId: string, attempt: number, reason: string): Promise<ReleaseResult> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      transferStatus: 'FAILED',
      transferAttempt: attempt,
      transferFailureReason: reason,
    },
  });
  return { status: 'FAILED', reason };
}

function isStripeNetworkError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'type' in err) {
    const stripeErr = err as { type: string };
    return stripeErr.type === 'StripeConnectionError' || stripeErr.type === 'StripeAPIError';
  }
  return false;
}

export { getTransferAmountPence } from './transfer-amount';
