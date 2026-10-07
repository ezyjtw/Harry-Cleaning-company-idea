// B4 money holds (RENA-017, RENA-093, D-ac N7).
//
// Three reasons a release waits, and they coexist: an open customer dispute,
// a payment shortfall, an open Stripe chargeback. A held booking sits at
// transferStatus PAUSED; it is resumed only when moneyHoldReasons(booking) is
// empty, so lifting one hold never releases money another hold still guards.

import type Stripe from 'stripe';

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { holdReasonsFor } from '@/lib/money/ledger-db';

import { AuditService } from './audit.service';

/** Find the booking a charge belongs to (the original or a top-up charge). */
async function bookingForCharge(chargeId: string | null | undefined): Promise<string | null> {
  if (!chargeId) return null;
  const b = await prisma.booking.findUnique({
    where: { stripeChargeId: chargeId },
    select: { id: true },
  });
  if (b) return b.id;
  const t = await prisma.topupRecord.findUnique({
    where: { stripeChargeId: chargeId },
    select: { bookingId: true },
  });
  return t?.bookingId ?? null;
}

/** Pause an unreleased booking (claimable states only; never mid-flight money). */
export async function pauseForHold(bookingId: string): Promise<boolean> {
  const r = await prisma.booking.updateMany({
    where: { id: bookingId, transferStatus: { in: ['PENDING', 'FAILED'] } },
    data: { transferStatus: 'PAUSED' },
  });
  return r.count === 1;
}

/**
 * Resume a PAUSED release only when no hold remains. Returns the release
 * result, or SKIPPED with the reasons still holding it.
 */
export async function resumeIfUnheld(
  bookingId: string,
  audit: { trigger: 'SCHEDULER' | 'ADMIN' | 'DISPUTE_RESOLUTION' | 'SYSTEM'; actorId?: string }
): Promise<{ status: string; reason?: string }> {
  const reasons = await holdReasonsFor(prisma, bookingId);
  if (reasons.length > 0) return { status: 'SKIPPED', reason: `Held: ${reasons.join(', ')}` };
  const { resumePausedRelease } = await import('./transfer.service');
  return resumePausedRelease(bookingId, audit);
}

// ─── Chargebacks (N7) ─────────────────────────────────────

export async function recordChargeback(dispute: Stripe.Dispute): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const bookingId = await bookingForCharge(chargeId);
  if (!bookingId) {
    log.error('money_hold', 'chargeback_without_booking', { stripeDisputeId: dispute.id });
    return;
  }
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { transferStatus: true },
  });
  const afterRelease = booking.transferStatus === 'RELEASED';
  try {
    await prisma.chargebackHold.create({
      data: {
        bookingId,
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId ?? null,
        amountPence: dispute.amount,
        status: afterRelease ? 'AFTER_RELEASE' : 'OPEN',
      },
    });
  } catch (err) {
    // P2002: already recorded (a duplicate event).
    if ((err as { code?: string }).code === 'P2002') return;
    throw err;
  }
  if (afterRelease) {
    await AuditService.log({
      action: 'CHARGEBACK_AFTER_RELEASE',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { stripeDisputeId: dispute.id, amountPence: dispute.amount },
    }).catch(() => {});
    log.error('money_hold', 'chargeback_after_release', { bookingId, stripeDisputeId: dispute.id });
    return;
  }
  await pauseForHold(bookingId);
  await AuditService.log({
    action: 'CHARGEBACK_HOLD_OPENED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { stripeDisputeId: dispute.id, amountPence: dispute.amount },
  }).catch(() => {});
  log.warn('money_hold', 'chargeback_hold_opened', { bookingId, stripeDisputeId: dispute.id });
}

/**
 * A closed chargeback: WON lifts its hold and the release resumes when no
 * other hold remains. LOST keeps holding: the money left Rena, so whether the
 * cleaner is still paid is an admin decision in stuck-money (parked for
 * James's ruling, never decided by code).
 */
export async function closeChargeback(dispute: Stripe.Dispute): Promise<void> {
  const status = dispute.status === 'won' ? 'WON' : dispute.status === 'lost' ? 'LOST' : 'CLOSED';
  const hold = await prisma.chargebackHold.findUnique({ where: { stripeDisputeId: dispute.id } });
  if (!hold) return;
  if (hold.status === 'AFTER_RELEASE') {
    // Released money was never held; the row stays for the admin to settle.
    await prisma.chargebackHold.update({
      where: { id: hold.id },
      data: { closedAt: new Date() },
    });
    return;
  }
  const moved = await prisma.chargebackHold.updateMany({
    where: { id: hold.id, status: 'OPEN' },
    data: { status: status === 'LOST' ? 'LOST' : status, closedAt: new Date() },
  });
  if (moved.count !== 1) return;
  await AuditService.log({
    action: 'CHARGEBACK_HOLD_CLOSED',
    entityType: 'Booking',
    entityId: hold.bookingId,
    metadata: { stripeDisputeId: dispute.id, outcome: status },
  }).catch(() => {});
  if (status !== 'LOST') {
    await resumeIfUnheld(hold.bookingId, { trigger: 'SYSTEM' });
  }
}

/** Admin: release after a lost chargeback (the decision recorded and audited). */
export async function settleLostChargeback(
  holdId: string,
  actorId: string
): Promise<{ ok: boolean; error?: string }> {
  const hold = await prisma.chargebackHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== 'LOST') return { ok: false, error: 'Not a lost chargeback' };
  const moved = await prisma.chargebackHold.updateMany({
    where: { id: holdId, status: 'LOST' },
    data: { status: 'CLOSED' },
  });
  if (moved.count !== 1) return { ok: false, error: 'Not a lost chargeback' };
  await AuditService.log({
    userId: actorId,
    action: 'CHARGEBACK_HOLD_CLOSED',
    entityType: 'Booking',
    entityId: hold.bookingId,
    metadata: { stripeDisputeId: hold.stripeDisputeId, outcome: 'LOST_SETTLED_BY_ADMIN' },
  }).catch(() => {});
  await resumeIfUnheld(hold.bookingId, { trigger: 'ADMIN', actorId });
  return { ok: true };
}

// ─── Shortfall (RENA-017) ─────────────────────────────────

/**
 * Admin "Accept shortfall and release" (B4 gate ruling 5): an explicit,
 * audited decision (who, when, why) to pay the cleaner although Stripe
 * received less than expected. The expected, captured and shortfall amounts
 * are all retained (the shortfall field stays; expected is totalAmountCharged;
 * captured is expected less shortfall, which the ledger already uses as the
 * refund ceiling). The cleaner's earnings are untouched (M2). An admin who
 * intends to collect the difference instead does nothing: the hold stays.
 */
export async function acceptShortfallAndRelease(
  bookingId: string,
  actorId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const why = reason.trim();
  if (why.length < 5) return { ok: false, error: 'A reason is required to accept a shortfall' };
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      amountShortfallPence: true,
      shortfallAcceptedAt: true,
      totalAmountCharged: true,
      totalPrice: true,
    },
  });
  if (!b || !b.amountShortfallPence) return { ok: false, error: 'No shortfall on this booking' };
  if (b.shortfallAcceptedAt) return { ok: false, error: 'This shortfall was already accepted' };
  const expectedPence = Math.round(Number(b.totalAmountCharged ?? b.totalPrice) * 100);
  const now = new Date();
  const r = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      amountShortfallPence: b.amountShortfallPence,
      shortfallAcceptedAt: null,
    },
    data: { shortfallAcceptedAt: now, shortfallAcceptedById: actorId, shortfallAcceptReason: why },
  });
  if (r.count !== 1) return { ok: false, error: 'The shortfall changed; refresh and retry' };
  await AuditService.log({
    userId: actorId,
    action: 'SHORTFALL_ACCEPTED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      expectedPence,
      capturedPence: expectedPence - b.amountShortfallPence,
      shortfallPence: b.amountShortfallPence,
      reason: why,
      acceptedAt: now.toISOString(),
    },
  }).catch(() => {});
  await resumeIfUnheld(bookingId, { trigger: 'ADMIN', actorId });
  return { ok: true };
}

/**
 * Admin: a chargeback that arrived after the payout (CHARGEBACK_AFTER_RELEASE)
 * has been dealt with outside the platform (recovered from the cleaner, or
 * absorbed); recorded and audited, no money moves here.
 */
export async function acknowledgeChargebackAfterRelease(
  holdId: string,
  actorId: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await prisma.chargebackHold.updateMany({
    where: { id: holdId, status: 'AFTER_RELEASE' },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  if (r.count !== 1) return { ok: false, error: 'Not an open chargeback after release' };
  const hold = await prisma.chargebackHold.findUniqueOrThrow({ where: { id: holdId } });
  await AuditService.log({
    userId: actorId,
    action: 'CHARGEBACK_HOLD_CLOSED',
    entityType: 'Booking',
    entityId: hold.bookingId,
    metadata: { stripeDisputeId: hold.stripeDisputeId, outcome: 'AFTER_RELEASE_ACKNOWLEDGED' },
  }).catch(() => {});
  return { ok: true };
}
