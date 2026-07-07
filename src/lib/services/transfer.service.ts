import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';
import { getTransferAmountPence } from './transfer-amount';
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

  // M2: cleaner earnings are SACRED — a promo discount never reduces them, so
  // on deeply-discounted bookings the transfer can legitimately EXCEED the
  // captured charge (Rena funds the gap from its own balance). Stripe hard-caps
  // source_transaction transfers at the charge amount, so the release is
  // planned as up to TWO slices:
  //   anchored = min(remaining, charge headroom) — funded by the charge
  //              (source_transaction, settles even before payout availability)
  //   excess   = the rest — a SEPARATE transfer funded from the platform's
  //              available balance (no source_transaction). Mechanism chosen:
  //              split transfer (not "top up the charge") — see gate notes.
  // NOTE: the excess slice requires available platform balance; if the balance
  // is short Stripe rejects it, the release goes FAILED with a clear reason,
  // and the standard retry path (scheduler / admin release-funds) picks it up.
  const chargePence = Math.round(Number(booking.totalAmountCharged ?? booking.totalPrice) * 100);

  // ── Reconcile FIRST, always ─────────────────────────────
  // Previously gated on UNKNOWN/RELEASING; now unconditional because a split
  // release can partially succeed (slice A on Stripe, slice B failed) from a
  // FAILED state too. Listing the transfer_group and planning only the
  // SHORTFALL makes every retry convergent and double-pay impossible.
  let alreadyPence = 0;
  let anchoredAlreadyPence = 0;
  const existingIds: string[] = [];
  try {
    const existing = await stripe.transfers.list({ transfer_group: bookingId, limit: 100 });
    for (const t of existing.data) {
      alreadyPence += t.amount;
      existingIds.push(t.id);
      const src = typeof t.source_transaction === 'string' ? t.source_transaction : t.source_transaction?.id;
      if (src && src === booking.stripeChargeId) anchoredAlreadyPence += t.amount;
    }
  } catch (err) {
    // Can't see Stripe — do NOT create blind. Leave claim for a clean retry.
    const reason = err instanceof Error ? err.message : 'transfer list failed';
    return setUnknown(bookingId, `Reconciliation list failed: ${reason}`);
  }

  if (alreadyPence >= transferPence) {
    // Fully covered by existing transfer(s) — adopt them.
    const joined = existingIds.join(',');
    await prisma.booking.update({
      where: { id: bookingId },
      data: { stripeTransferId: joined, transferStatus: 'RELEASED', transferFailureReason: null },
    });
    await enqueueXeroPush({
      bookingId,
      event: 'PAYOUT',
      occurredAt: new Date().toISOString(),
    }).catch(() => {});
    await auditFundsReleased(bookingId, joined, transferPence, audit, true);
    return { status: 'RELEASED', transferId: joined };
  }

  // ── Plan the shortfall as slices ────────────────────────
  const remainingPence = transferPence - alreadyPence;
  const anchoredHeadroom = Math.max(0, chargePence - anchoredAlreadyPence);
  const anchoredPence = Math.min(remainingPence, anchoredHeadroom);
  const excessPence = remainingPence - anchoredPence;

  const attempt = booking.transferAttempt + 1;
  const slices: { amountPence: number; anchored: boolean; idempotencyKey: string }[] = [];
  if (anchoredPence > 0) {
    // Legacy key format for the anchored slice — in-flight retries from before
    // the split mechanism keep their idempotency.
    slices.push({
      amountPence: anchoredPence,
      anchored: true,
      idempotencyKey: `release_${bookingId}_v${attempt}`,
    });
  }
  if (excessPence > 0) {
    slices.push({
      amountPence: excessPence,
      anchored: false,
      idempotencyKey: `release_${bookingId}_v${attempt}_x`,
    });
  }

  // ── Execute slices ──────────────────────────────────────
  const createdIds: string[] = [];
  for (const slice of slices) {
    const params = {
      amount: slice.amountPence,
      currency: 'gbp' as const,
      destination: profile.stripeAccountId,
      ...(slice.anchored ? { source_transaction: booking.stripeChargeId } : {}),
      transfer_group: bookingId,
      metadata: { bookingId, renaFunded: slice.anchored ? 'false' : 'true' },
    };
    try {
      const t = await stripe.transfers.create(params, { idempotencyKey: slice.idempotencyKey });
      createdIds.push(t.id);
    } catch (err: unknown) {
      if (isUnknownOutcome(err)) {
        // One same-key retry; Stripe returns the original if it went through.
        try {
          const t = await stripe.transfers.create(params, {
            idempotencyKey: slice.idempotencyKey,
          });
          createdIds.push(t.id);
          continue;
        } catch (retryErr: unknown) {
          // Still unknown — do NOT bump attempt; next run reconciles first and
          // creates only whatever genuinely didn't land.
          const reason = retryErr instanceof Error ? retryErr.message : 'Network retry failed';
          return setUnknown(bookingId, `Network error + retry failed: ${reason}`);
        }
      }
      // Definitive error. Anything already created this run is safe: the next
      // retry reconciles the group and plans only the shortfall.
      const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
      const context = slice.anchored
        ? reason
        : `Rena-funded excess slice failed (platform balance?): ${reason}`;
      return setFailed(bookingId, attempt, context);
    }
  }

  const allIds = [...existingIds, ...createdIds].join(',');
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      stripeTransferId: allIds,
      transferStatus: 'RELEASED',
      transferAttempt: attempt,
      transferFailureReason: null,
    },
  });

  await enqueueXeroPush({
    bookingId,
    event: 'PAYOUT',
    occurredAt: new Date().toISOString(),
  }).catch(() => {});
  await auditFundsReleased(bookingId, allIds, transferPence, audit, existingIds.length > 0);
  return { status: 'RELEASED', transferId: allIds };
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
