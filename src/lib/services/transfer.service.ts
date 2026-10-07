// ─── B4 releases as transfer slices (RENA-010, RENA-087) ─────────────────────
//
// Single owner of every cleaner payout. Separate charges and transfers: the
// platform charge (and each top-up charge) funds Stripe transfers to the
// cleaner's connected account, grouped by transfer_group = bookingId.
//
// Every transfer found or created is a TransferSlice row:
//   ANCHORED  source_transaction = one of the booking's charges, at most that
//             charge's own amount (the original, and each succeeded top-up
//             charge on its own: RENA-087)
//   EXCESS    the rest, funded from the platform balance (M2: cleaner earnings
//             are sacred, a promo never reduces them)
//   ADOPTED   a legacy transfer migrated from Booking.stripeTransferId
// RELEASED iff Σ slice amountPence >= the transfer amount.
//
// A release waits while moneyHoldReasons(booking) is non-empty (dispute,
// shortfall, chargeback; they coexist). Failure writes are guarded on
// RELEASING so a late writer cannot stomp a state another path moved on.

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { isUnknownStripeOutcome, nextRetryAt, toPence } from '@/lib/money/ledger';
import { holdReasonsFor } from '@/lib/money/ledger-db';
import stripe from '@/lib/stripe';

import { AuditService } from './audit.service';
import { EnhancedNotificationService } from './enhanced-notification.service';
import { TOPUP_WITHOUT_ASSIGNMENT } from './topup-flag';
import { getTransferAmountPence } from './transfer-amount';
import { enqueueXeroPush } from './xero-push.service';

// ─── Types ─────────────────────────────────────────────────

export interface ReleaseResult {
  status: 'RELEASED' | 'FAILED' | 'UNKNOWN' | 'ALREADY_RELEASED' | 'SKIPPED';
  transferId?: string;
  reason?: string;
}

// SECURITY (S5): who/what asked for this release — recorded on every executed
// transfer. `actorId` is the acting admin on manual/dispute paths.
export interface ReleaseAudit {
  trigger: 'SCHEDULER' | 'ADMIN' | 'DISPUTE_RESOLUTION' | 'SYSTEM';
  actorId?: string;
}

async function auditFundsReleased(
  bookingId: string,
  transferIds: string[],
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
      transferId: transferIds.join(','),
      amountPence,
      trigger: audit.trigger,
      ...(adoptedFromReconciliation ? { adoptedFromReconciliation: true } : {}),
    },
  }).catch(() => {});
}

interface AnchorCharge {
  chargeId: string;
  capturedPence: number;
  /** null for the original charge; the top-up record id otherwise. */
  topupRecordId: string | null;
}

function sourceOf(t: { source_transaction?: string | { id: string } | null }): string | null {
  const src = t.source_transaction;
  if (!src) return null;
  return typeof src === 'string' ? src : src.id;
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
      topupRecords: {
        where: { status: 'SUCCEEDED', stripePaymentIntentId: { not: null } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!booking) return { status: 'FAILED', reason: 'Booking not found' };

  if (booking.transferStatus === 'RELEASED') {
    return { status: 'ALREADY_RELEASED', transferId: booking.stripeTransferId ?? undefined };
  }
  if (['PAUSED', 'REFUNDED', 'REFUNDING'].includes(booking.transferStatus)) {
    return { status: 'SKIPPED', reason: `Transfer is ${booking.transferStatus}` };
  }

  // Holds first (N7): a held booking pauses instead of releasing.
  const holds = await holdReasonsFor(prisma, bookingId);
  if (holds.length > 0) {
    await prisma.booking.updateMany({
      where: { id: bookingId, transferStatus: { in: ['PENDING', 'FAILED'] } },
      data: { transferStatus: 'PAUSED' },
    });
    await AuditService.log({
      userId: audit.actorId,
      action: 'RELEASE_HELD',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { holds },
    }).catch(() => {});
    return { status: 'SKIPPED', reason: `Held: ${holds.join(', ')}` };
  }

  // ── Concurrency claim ──────────────────────────────────
  // RELEASING is claimable too: covers crash-after-success, which the
  // transfer_group reconciliation below makes convergent.
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: { in: ['PENDING', 'UNKNOWN', 'FAILED', 'RELEASING'] } },
    data: { transferStatus: 'RELEASING' },
  });
  if (claimed.count === 0) {
    return { status: 'SKIPPED', reason: 'Another worker is already processing this transfer' };
  }

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

  // ── The booking's charges (RENA-087) ────────────────────
  // The original's own amount is the captured total less every succeeded
  // top-up. A flagged TOPUP_WITHOUT_ASSIGNMENT top-up never funds this
  // cleaner's payout (B3 R2), so it anchors nothing.
  const topupTotal = booking.topupRecords.reduce((s, t) => s + toPence(t.amount), 0);
  const charges: AnchorCharge[] = [
    {
      chargeId: booking.stripeChargeId,
      capturedPence: Math.max(
        0,
        toPence(booking.totalAmountCharged ?? booking.totalPrice) - topupTotal
      ),
      topupRecordId: null,
    },
  ];
  for (const t of booking.topupRecords) {
    if ((t.failureReason ?? '').startsWith(TOPUP_WITHOUT_ASSIGNMENT)) continue;
    let chargeId = t.stripeChargeId;
    if (!chargeId && t.stripePaymentIntentId) {
      // Older top-ups never stored their charge: read it once and keep it.
      try {
        const pi = await stripe.paymentIntents.retrieve(t.stripePaymentIntentId);
        chargeId =
          typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null);
        if (chargeId) {
          await prisma.topupRecord.update({
            where: { id: t.id },
            data: { stripeChargeId: chargeId },
          });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'payment intent read failed';
        return setUnknown(bookingId, `Top-up charge lookup failed: ${reason}`);
      }
    }
    if (chargeId) charges.push({ chargeId, capturedPence: toPence(t.amount), topupRecordId: t.id });
  }

  // ── Reconcile FIRST, always ─────────────────────────────
  // Every transfer in the group becomes (or already is) a slice; only the
  // shortfall is planned, so every retry converges and double pay is impossible.
  let alreadyPence = 0;
  const anchoredAlready = new Map<string, number>();
  const existingIds: string[] = [];
  try {
    const existing = await stripe.transfers.list({ transfer_group: bookingId, limit: 100 });
    for (const t of existing.data) {
      alreadyPence += t.amount;
      existingIds.push(t.id);
      const src = sourceOf(t);
      if (src) anchoredAlready.set(src, (anchoredAlready.get(src) ?? 0) + t.amount);
      await upsertSlice(bookingId, {
        stripeTransferId: t.id,
        amountPence: t.amount,
        reversedPence: t.amount_reversed ?? 0,
        kind: src ? 'ANCHORED' : 'EXCESS',
        sourceChargeId: src,
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'transfer list failed';
    return setUnknown(bookingId, `Reconciliation list failed: ${reason}`);
  }

  if (alreadyPence >= transferPence) {
    return markReleased(
      bookingId,
      existingIds,
      booking.transferAttempt,
      transferPence,
      audit,
      true
    );
  }

  // ── Plan the shortfall: one anchored slice per charge, then the excess ──
  const attempt = booking.transferAttempt + 1;
  let remaining = transferPence - alreadyPence;
  const plan: { amountPence: number; source: string | null; key: string }[] = [];
  for (const c of charges) {
    if (remaining <= 0) break;
    const headroom = Math.max(0, c.capturedPence - (anchoredAlready.get(c.chargeId) ?? 0));
    const take = Math.min(remaining, headroom);
    if (take <= 0) continue;
    plan.push({
      amountPence: take,
      source: c.chargeId,
      // The original's key keeps its legacy shape for in-flight retries.
      key: c.topupRecordId
        ? `release_${bookingId}_t${c.topupRecordId}_v${attempt}`
        : `release_${bookingId}_v${attempt}`,
    });
    remaining -= take;
  }
  if (remaining > 0) {
    plan.push({ amountPence: remaining, source: null, key: `release_${bookingId}_v${attempt}_x` });
  }

  const createdIds: string[] = [];
  for (const slice of plan) {
    const params = {
      amount: slice.amountPence,
      currency: 'gbp' as const,
      destination: profile.stripeAccountId,
      ...(slice.source ? { source_transaction: slice.source } : {}),
      transfer_group: bookingId,
      metadata: { bookingId, renaFunded: slice.source ? 'false' : 'true' },
    };
    let t: { id: string; amount: number } | null = null;
    try {
      t = await stripe.transfers.create(params, { idempotencyKey: slice.key });
    } catch (err) {
      if (isUnknownStripeOutcome(err)) {
        try {
          // One same-key retry; Stripe returns the original if it went through.
          t = await stripe.transfers.create(params, { idempotencyKey: slice.key });
        } catch (retryErr) {
          const reason = retryErr instanceof Error ? retryErr.message : 'Network retry failed';
          // Do not bump the attempt: the next run reconciles the group first.
          return setUnknown(bookingId, `Network error + retry failed: ${reason}`);
        }
      } else {
        const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
        return setFailed(
          bookingId,
          attempt,
          slice.source ? reason : `Rena-funded excess slice failed (platform balance?): ${reason}`
        );
      }
    }
    if (!t) continue;
    createdIds.push(t.id);
    await upsertSlice(bookingId, {
      stripeTransferId: t.id,
      amountPence: t.amount,
      reversedPence: 0,
      kind: slice.source ? 'ANCHORED' : 'EXCESS',
      sourceChargeId: slice.source,
      idempotencyKey: slice.key,
      attempt,
    });
  }

  return markReleased(
    bookingId,
    [...existingIds, ...createdIds],
    attempt,
    transferPence,
    audit,
    existingIds.length > 0
  );
}

async function upsertSlice(
  bookingId: string,
  t: {
    stripeTransferId: string;
    amountPence: number;
    reversedPence: number;
    kind: string;
    sourceChargeId: string | null;
    idempotencyKey?: string;
    attempt?: number;
  }
): Promise<void> {
  const status =
    t.reversedPence >= t.amountPence && t.amountPence > 0
      ? 'REVERSED'
      : t.reversedPence > 0
        ? 'PARTIALLY_REVERSED'
        : 'CREATED';
  await prisma.transferSlice.upsert({
    where: { stripeTransferId: t.stripeTransferId },
    create: {
      bookingId,
      stripeTransferId: t.stripeTransferId,
      amountPence: t.amountPence,
      reversedPence: t.reversedPence,
      kind: t.kind,
      sourceChargeId: t.sourceChargeId,
      status,
      idempotencyKey: t.idempotencyKey ?? null,
      attempt: t.attempt ?? 0,
      lastReconciledAt: new Date(),
    },
    update: {
      amountPence: t.amountPence,
      reversedPence: t.reversedPence,
      sourceChargeId: t.sourceChargeId,
      status,
      lastReconciledAt: new Date(),
    },
  });
}

async function markReleased(
  bookingId: string,
  transferIds: string[],
  attempt: number,
  transferPence: number,
  audit: ReleaseAudit,
  adopted: boolean
): Promise<ReleaseResult> {
  // Booking.stripeTransferId mirrors the first slice for one batch (B9 drops it).
  const moved = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: 'RELEASING' },
    data: {
      stripeTransferId: transferIds[0] ?? null,
      transferStatus: 'RELEASED',
      transferAttempt: attempt,
      transferFailureReason: null,
    },
  });
  if (moved.count !== 1) {
    return { status: 'SKIPPED', reason: 'The booking left RELEASING while the payout ran' };
  }
  // A chargeback that arrived while the payout was in flight is now after release.
  await prisma.chargebackHold.updateMany({
    where: { bookingId, status: 'OPEN' },
    data: { status: 'AFTER_RELEASE' },
  });
  await enqueueXeroPush({ bookingId, event: 'PAYOUT', occurredAt: new Date().toISOString() }).catch(
    () => {}
  );
  await auditFundsReleased(bookingId, transferIds, transferPence, audit, adopted);
  // 1.0.1 cargo (James-sealed): the money-release push, after the money moved.
  await EnhancedNotificationService.sendMoneyReleasePush(bookingId).catch(() => {});
  return { status: 'RELEASED', transferId: transferIds[0] };
}

// Definitive failure: bump transferAttempt so the next retry gets a new key.
// Guarded: only the worker that holds RELEASING may write it.
async function setFailed(
  bookingId: string,
  attempt: number,
  reason: string
): Promise<ReleaseResult> {
  await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: 'RELEASING' },
    data: { transferStatus: 'FAILED', transferAttempt: attempt, transferFailureReason: reason },
  });
  log.warn('transfer', 'release_failed', { bookingId });
  return { status: 'FAILED', reason };
}

// Unknown outcome: keep the attempt (and so the idempotency key). Guarded.
async function setUnknown(bookingId: string, reason: string): Promise<ReleaseResult> {
  await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: 'RELEASING' },
    data: { transferStatus: 'UNKNOWN', transferFailureReason: reason },
  });
  log.error('transfer', 'release_unknown', { bookingId });
  return { status: 'UNKNOWN', reason };
}

/**
 * Resume a paused release: PAUSED → PENDING, then release. Refused while any
 * hold remains (dispute, shortfall, chargeback).
 */
export async function resumePausedRelease(
  bookingId: string,
  audit: ReleaseAudit = { trigger: 'SYSTEM' }
): Promise<ReleaseResult> {
  const holds = await holdReasonsFor(prisma, bookingId);
  if (holds.length > 0) return { status: 'SKIPPED', reason: `Held: ${holds.join(', ')}` };
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: 'PAUSED' },
    data: { transferStatus: 'PENDING' },
  });
  if (claimed.count === 0) {
    return { status: 'SKIPPED', reason: 'Transfer is not PAUSED — cannot resume' };
  }
  return releaseBookingFunds(bookingId, audit);
}

/** Stuck-money: a COMPLETED booking whose release clock was never set (override). */
export async function setReleaseClock(bookingId: string, actorId: string): Promise<boolean> {
  const r = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'COMPLETED', transferStatus: 'PENDING', releaseDueAt: null },
    data: { releaseDueAt: new Date() },
  });
  if (r.count === 1) {
    await AuditService.log({
      userId: actorId,
      action: 'RELEASE_CLOCK_SET',
      entityType: 'Booking',
      entityId: bookingId,
    }).catch(() => {});
  }
  return r.count === 1;
}

/**
 * Scheduler (B4.10 step 3): fill NEEDS_RECONCILE slices from Stripe, read only,
 * 50 per tick with backoff. Never creates or moves money.
 */
export async function reconcileTransferSlices(limit = 50): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.transferSlice.findMany({
    where: {
      status: 'NEEDS_RECONCILE',
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    take: limit,
  });
  let processed = 0;
  for (const s of due) {
    try {
      const t = await stripe.transfers.retrieve(s.stripeTransferId);
      const src = sourceOf(t);
      const reversed = t.amount_reversed ?? 0;
      await prisma.transferSlice.update({
        where: { id: s.id },
        data: {
          amountPence: t.amount,
          reversedPence: reversed,
          kind: s.kind === 'ADOPTED' ? (src ? 'ANCHORED' : 'EXCESS') : s.kind,
          sourceChargeId: src,
          status:
            reversed >= t.amount && t.amount > 0
              ? 'REVERSED'
              : reversed > 0
                ? 'PARTIALLY_REVERSED'
                : 'CREATED',
          lastReconciledAt: now,
          lastReconcileResult: 'filled from stripe.transfers.retrieve',
        },
      });
      processed++;
    } catch (err) {
      await prisma.transferSlice.update({
        where: { id: s.id },
        data: {
          retryCount: s.retryCount + 1,
          nextRetryAt: nextRetryAt(now, s.retryCount + 1),
          lastReconciledAt: now,
          lastReconcileResult: `stripe read failed: ${err instanceof Error ? err.message : 'error'}`,
        },
      });
    }
  }
  return { processed };
}

export { getTransferAmountPence } from './transfer-amount';
