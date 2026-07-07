import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';
import {
  findMatchingTransfer,
  getTransferAmountPence,
  needsReconciliation,
} from './transfer-amount';
import { enqueueXeroPush } from './xero-push.service';

// ─── Types ─────────────────────────────────────────────────

export interface ReleaseResult {
  status: 'RELEASED' | 'FAILED' | 'UNKNOWN' | 'ALREADY_RELEASED' | 'SKIPPED';
  transferId?: string;
  reason?: string;
}

// SECURITY (S5): who/what asked for this release — recorded on every executed
// transfer (mirrors the refund audit pattern). `actorId` is the acting admin on
// manual/dispute paths; scheduler runs have no actor.
export interface ReleaseAudit {
  trigger: 'SCHEDULER' | 'ADMIN' | 'DISPUTE_RESOLUTION' | 'SYSTEM';
  actorId?: string;
}

/** Audit an EXECUTED transfer (money moved). Never throws — audit failure must
 *  not fail a release that already happened on Stripe. */
async function auditFundsReleased(
  bookingId: string,
  transferId: string,
  amountPence: number,
  audit: ReleaseAudit,
  adoptedFromReconciliation = false
): Promise<void> {
  await AuditService.log({
    userId: audit.actorId,
    action: 'FUNDS_RELEASED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      transferId,
      amountPence,
      trigger: audit.trigger,
      ...(adoptedFromReconciliation ? { adoptedFromReconciliation: true } : {}),
    },
  }).catch(() => {});
}

// ─── Error Classification ─────────────────────────────────
//
// Unknown-outcome (MUST NOT bump transferAttempt — preserves idempotency key):
//   StripeConnectionError — ETIMEDOUT, ECONNRESET, DNS failures
//   StripeAPIError        — Stripe 500/502/503/504; server may have processed
//
// Definitive (safe to bump transferAttempt — new idempotency key on next retry):
//   StripeInvalidRequestError — bad parameters, invalid account
//   StripeCardError           — declined (unlikely for transfers)
//   StripeAuthenticationError — bad API key
//   StripePermissionError     — insufficient permissions
//   StripeRateLimitError      — request rejected before processing
//   StripeIdempotencyError    — idempotency key conflict

function isUnknownOutcome(err: unknown): boolean {
  if (err && typeof err === 'object' && 'type' in err) {
    const stripeErr = err as { type: string };
    return stripeErr.type === 'StripeConnectionError' || stripeErr.type === 'StripeAPIError';
  }
  return false;
}

// ─── Reconciliation ───────────────────────────────────────
// After a non-clean prior state (UNKNOWN or RELEASING), the transfer may
// already exist on Stripe. We must check before creating to prevent double-pay.
// Uses transfer_group=bookingId for a deterministic lookup that cannot miss
// regardless of how many transfers the cleaner has.

async function reconcileExistingTransfer(
  bookingId: string,
  chargeId: string
): Promise<string | null> {
  const existing = await stripe.transfers.list({
    transfer_group: bookingId,
    limit: 100,
  });
  return findMatchingTransfer(existing.data, chargeId);
}

// ─── Service ───────────────────────────────────────────────

export async function releaseBookingFunds(
  bookingId: string,
  audit: ReleaseAudit = { trigger: 'SYSTEM' }
): Promise<ReleaseResult> {
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

  // Terminal states
  if (booking.transferStatus === 'RELEASED') {
    return { status: 'ALREADY_RELEASED', transferId: booking.stripeTransferId ?? undefined };
  }
  if (booking.transferStatus === 'PAUSED' || booking.transferStatus === 'REFUNDED') {
    return { status: 'SKIPPED', reason: `Transfer is ${booking.transferStatus}` };
  }

  // ── Concurrency claim ──────────────────────────────────
  // Atomic transition: only one worker can move from a claimable state to RELEASING.
  // RELEASING is claimable too — covers crash-after-success where the previous
  // worker created the Stripe transfer but crashed before writing stripeTransferId.
  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      transferStatus: { in: ['PENDING', 'UNKNOWN', 'FAILED', 'RELEASING'] },
    },
    data: { transferStatus: 'RELEASING' },
  });

  if (claimed.count === 0) {
    return { status: 'SKIPPED', reason: 'Another worker is already processing this transfer' };
  }

  const previousStatus = booking.transferStatus;

  // ── Validation (under our ownership) ───────────────────
  if (!booking.stripeChargeId) {
    return setFailed(
      bookingId,
      booking.transferAttempt,
      'No charge ID on booking — payment may not have succeeded'
    );
  }

  const profile = booking.cleaner?.cleanerProfile;
  if (!profile?.stripeAccountId) {
    return setFailed(bookingId, booking.transferAttempt, 'Cleaner has no Stripe Connect account');
  }
  if (!profile.stripeChargesEnabled || !profile.stripePayoutsEnabled) {
    return setFailed(
      bookingId,
      booking.transferAttempt,
      'Cleaner Connect account not ready: charges or payouts not enabled'
    );
  }

  const transferPence = getTransferAmountPence(Number(booking.cleanerEarnings));
  if (transferPence <= 0) {
    return setFailed(
      bookingId,
      booking.transferAttempt,
      `Transfer amount is ${transferPence} pence — cannot be zero or negative`
    );
  }

  // source_transaction (below) is the original charge — the transfer cannot exceed
  // it. Anchor the sanity check to the original charged amount, not totalPrice
  // (which drifts after top-up / cheaper reassign).
  const chargePence = Math.round(Number(booking.totalAmountCharged ?? booking.totalPrice) * 100);
  if (transferPence > chargePence) {
    return setFailed(
      bookingId,
      booking.transferAttempt,
      `Transfer ${transferPence}p exceeds charge ${chargePence}p`
    );
  }

  // ── Reconciliation (after non-clean prior state) ───────
  // UNKNOWN: network error — transfer may or may not exist.
  // RELEASING: crash after stripe.transfers.create succeeded but before DB write.
  // Both require checking Stripe before creating to prevent double-pay.
  if (needsReconciliation(previousStatus)) {
    const existingId = await reconcileExistingTransfer(bookingId, booking.stripeChargeId);
    if (existingId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          stripeTransferId: existingId,
          transferStatus: 'RELEASED',
          transferFailureReason: null,
        },
      });
      // A13-Xero-c: record the cleaner payout as Spend Money (gated + idempotent).
      await enqueueXeroPush({
        bookingId,
        event: 'PAYOUT',
        occurredAt: new Date().toISOString(),
      }).catch(() => {});
      await auditFundsReleased(bookingId, existingId, transferPence, audit, true);
      return { status: 'RELEASED', transferId: existingId };
    }
  }

  // ── Create transfer ────────────────────────────────────
  const attempt = booking.transferAttempt + 1;
  const idempotencyKey = `release_${bookingId}_v${attempt}`;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: transferPence,
        currency: 'gbp',
        destination: profile.stripeAccountId,
        source_transaction: booking.stripeChargeId,
        transfer_group: bookingId,
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

    await enqueueXeroPush({
      bookingId,
      event: 'PAYOUT',
      occurredAt: new Date(transfer.created * 1000).toISOString(),
    }).catch(() => {});
    await auditFundsReleased(bookingId, transfer.id, transferPence, audit);
    return { status: 'RELEASED', transferId: transfer.id };
  } catch (err: unknown) {
    if (isUnknownOutcome(err)) {
      // Unknown outcome — retry with the SAME idempotency key. Stripe returns
      // the original response if it went through, or processes fresh if it didn't.
      try {
        const retryTransfer = await stripe.transfers.create(
          {
            amount: transferPence,
            currency: 'gbp',
            destination: profile.stripeAccountId,
            source_transaction: booking.stripeChargeId,
            transfer_group: bookingId,
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

        await enqueueXeroPush({
          bookingId,
          event: 'PAYOUT',
          occurredAt: new Date(retryTransfer.created * 1000).toISOString(),
        }).catch(() => {});
        await auditFundsReleased(bookingId, retryTransfer.id, transferPence, audit);
        return { status: 'RELEASED', transferId: retryTransfer.id };
      } catch (retryErr: unknown) {
        // Still unknown — set UNKNOWN, do NOT bump transferAttempt.
        // Next retry will use the same idempotency key AND reconcile first.
        const reason = retryErr instanceof Error ? retryErr.message : 'Network retry failed';
        return setUnknown(bookingId, `Network error + retry failed: ${reason}`);
      }
    }

    // Definitive Stripe error — safe to bump attempt (new idempotency key next time)
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
    return setFailed(bookingId, attempt, reason);
  }
}

// Definitive failure: bump transferAttempt so next retry gets a new idempotency key.
async function setFailed(
  bookingId: string,
  attempt: number,
  reason: string
): Promise<ReleaseResult> {
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

// Unknown outcome: do NOT bump transferAttempt — preserves the idempotency key
// so the next attempt either gets the original response or creates fresh.
async function setUnknown(bookingId: string, reason: string): Promise<ReleaseResult> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      transferStatus: 'UNKNOWN',
      transferFailureReason: reason,
    },
  });
  return { status: 'UNKNOWN', reason };
}

/**
 * Resume a paused release: atomically move PAUSED → PENDING, then call
 * releaseBookingFunds which handles PENDING → RELEASING → RELEASED.
 * Used by dispute resolution (release-to-cleaner / split outcomes).
 */
export async function resumePausedRelease(
  bookingId: string,
  audit: ReleaseAudit = { trigger: 'SYSTEM' }
): Promise<ReleaseResult> {
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: 'PAUSED' },
    data: { transferStatus: 'PENDING' },
  });
  if (claimed.count === 0) {
    return { status: 'SKIPPED', reason: 'Transfer is not PAUSED — cannot resume' };
  }
  return releaseBookingFunds(bookingId, audit);
}

export { getTransferAmountPence } from './transfer-amount';
