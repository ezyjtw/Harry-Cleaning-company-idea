/**
 * A5.1 Cascade offer service.
 *
 * Manages the primary → backup → exhausted cascade for direct-assignment bookings.
 * All state transitions use atomic updateMany with phase+status guards so that
 * concurrent requests (two backups accepting, scheduler + decline, etc.) can never
 * double-advance or corrupt state.
 */

import type { Booking, BookingStatus, CascadePhase, PropertySize } from '@prisma/client';

import { filterSlotAvailableCleaners } from '@/lib/availability/slot-eligibility';
import { ASSIGN_FAILURE_MESSAGE, type AssignFailure, assignCleaner } from '@/lib/booking/assign';
import {
  normalizeToPricingSlug,
  propertySizeEnumToSlug,
  serviceLabelFromSlug,
} from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { getReviewCounts } from '@/lib/services/rating.service';
import stripe from '@/lib/stripe';
import { bookingStartUtc } from '@/lib/time/booking-time';

import { AuditService } from './audit.service';
import { BookingReminderService } from './booking-reminder.service';
import {
  sendCascadeExhaustedRefund,
  sendCascadeSearchingUpdate,
  sendBackupOfferEmails,
  sendCleanerAcceptedBooking,
  sendCleanerJobAccepted,
  sendRenaFindConcierge,
  sendTopupApprovalRequest,
  sendTopupRevertNotice,
} from './email.service';
import { EnhancedNotificationService } from './enhanced-notification.service';
import { MatchingService } from './matching.service';
import { pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';
import { refundBooking } from './refund.service';

// ─── Window computation ────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;

// B3 sweep: the slot start is London wall time (D-f); the one helper owns it.
function parseSlotStart(bookingDate: Date, startTime: string): Date | null {
  return bookingStartUtc(bookingDate, startTime);
}

/** Cascade-state teardown fields — shared by cancel and reassign paths. */
export function cascadeTeardownFields() {
  return {
    cascadePhase: null,
    cascadeExpiresAt: null,
    cascadeBackupExpiresAt: null,
    provisionalCleanerId: null,
    provisionalPrice: null,
    topupAmount: null,
    approvalExpiresAt: null,
    topupApproved: false,
    reserveCleanerIds: [],
    provisionalSource: null,
    reassignPreviousStatus: null,
    reassignPreviousCleanerId: null,
  };
}

export interface CascadeWindows {
  initialPhase: CascadePhase;
  cascadeExpiresAt: Date;
  cascadeBackupExpiresAt: Date | null;
}

export function computeCascadeWindows(
  bookingDate: Date,
  startTime: string,
  now: Date
): CascadeWindows {
  const slotStart = parseSlotStart(bookingDate, startTime);

  if (!slotStart) {
    // eslint-disable-next-line no-console
    console.warn('[Cascade] Cannot parse slotStart — falling back to COMBINED_OFFER 12h');
    return {
      initialPhase: 'COMBINED_OFFER',
      cascadeExpiresAt: new Date(now.getTime() + 12 * HOUR_MS),
      cascadeBackupExpiresAt: null,
    };
  }

  const resolveBy = new Date(slotStart.getTime() - 24 * HOUR_MS);
  const runwayMs = resolveBy.getTime() - now.getTime();
  const runwayHours = runwayMs / HOUR_MS;

  if (runwayHours >= 36) {
    return {
      initialPhase: 'PRIMARY_OFFER',
      cascadeExpiresAt: new Date(now.getTime() + 12 * HOUR_MS),
      cascadeBackupExpiresAt: new Date(Math.min(now.getTime() + 30 * HOUR_MS, resolveBy.getTime())),
    };
  }

  if (runwayHours > 0) {
    const primaryMs = runwayMs * 0.4;
    return {
      initialPhase: 'PRIMARY_OFFER',
      cascadeExpiresAt: new Date(now.getTime() + primaryMs),
      cascadeBackupExpiresAt: new Date(Math.min(now.getTime() + runwayMs, resolveBy.getTime())),
    };
  }

  return {
    initialPhase: 'COMBINED_OFFER',
    cascadeExpiresAt: new Date(now.getTime() + 12 * HOUR_MS),
    cascadeBackupExpiresAt: null,
  };
}

// ─── Phase advancement ─────────────────────────────────────────

type BookingCascadeData = Pick<
  Booking,
  | 'cleanerId'
  | 'backupCleanerIds'
  | 'cascadePhase'
  | 'cascadeBackupExpiresAt'
  | 'declinedCleanerIds'
  | 'date'
  | 'startTime'
  | 'duration'
  | 'serviceType'
>;

async function advanceFromPrimary(bookingId: string, booking: BookingCascadeData): Promise<void> {
  // H7: re-validate REAL slot availability at OFFER time — a backup chosen at
  // booking time may have filled their diary since. Unavailable backups are
  // pruned from the array itself so every downstream consumer (jobs list,
  // accept qualification, all-declined bookkeeping) agrees; declined tracking
  // is untouched. Nobody genuinely free → straight to exhaustion handling
  // (which can still widen via Rena-Find).
  const notDeclined = booking.backupCleanerIds.filter(
    (id) => !(booking.declinedCleanerIds ?? []).includes(id)
  );
  const availableSet = await filterSlotAvailableCleaners(notDeclined, {
    date: booking.date,
    startTime: booking.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: bookingId,
  });
  const activeBackups = notDeclined.filter((id) => availableSet.has(id));

  if (activeBackups.length === 0) {
    await handleCascadeExhaustion(bookingId, 'PRIMARY_OFFER');
    return;
  }

  const backupExpiresAt = booking.cascadeBackupExpiresAt;
  if (!backupExpiresAt) {
    // eslint-disable-next-line no-console
    console.error('[Cascade] No backupExpiresAt for PRIMARY_OFFER booking', bookingId);
    return;
  }

  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'AWAITING_CLEANER', cascadePhase: 'PRIMARY_OFFER' },
    data: {
      cascadePhase: 'BACKUP_OFFER',
      cascadeExpiresAt: backupExpiresAt,
      cascadeBackupExpiresAt: null,
      backupCleanerIds: activeBackups,
    },
  });

  if (result.count === 0) return;

  for (const backupId of activeBackups) {
    await prisma.notification
      .create({
        data: {
          userId: backupId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${serviceLabelFromSlug(booking.serviceType)} job is available — first to accept gets it.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // F11: the bell alone was the hole — every active backup also gets the F1
  // offer email (sanitised, their own figure, Accept deep link). activeBackups
  // is already pruned of declined/unavailable — the corpse law holds.
  await sendBackupOfferEmails(bookingId, activeBackups).catch(() => {});
  // 1.0.1 cargo (James-sealed): native offer push per recipient — push-only
  // rider on the bells above; inert without registered tokens.
  for (const backupId of activeBackups) {
    await EnhancedNotificationService.sendNewOfferPush(bookingId, backupId).catch(() => {});
  }

  const clientBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true },
  });
  if (clientBooking?.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: clientBooking.clientId,
          type: 'SYSTEM',
          title: 'Offered to backup cleaners',
          body: "Your primary cleaner couldn't take this one — we've offered it to your backup cleaners.",
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // X1: chosen-cleaner → searching is NEVER silent — email BOTH audiences
  // (registered + guest; the sender resolves the recipient + tokened link).
  await sendCascadeSearchingUpdate(bookingId).catch(() => {});
}

/**
 * B3: payment success found the chosen cleaner's slot taken, recorded them as
 * declined and claimed PRIMARY_OFFER; move the offer to the backups now.
 */
export async function advanceFromPrimaryAfterPayment(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      cleanerId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      cascadeBackupExpiresAt: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
    },
  });
  if (!booking || booking.status !== 'AWAITING_CLEANER') return;
  if (booking.cascadePhase !== 'PRIMARY_OFFER') return;
  await advanceFromPrimary(bookingId, booking);
}

/**
 * B3 (James-ruled 2026-10-07): a cleaner who deletes their account while
 * offered a job (primary, backup, combined, Rena-Find or reserve phase) is
 * skipped by the cascade rather than blocking the deletion: each live offer is
 * declined on their behalf through the same guarded decline, so the offer
 * moves on now instead of waiting out the window. Reserve membership needs
 * nothing here: promotion's slot read skips a deactivated cleaner.
 */
export async function releaseOffersForDeletedCleaner(cleanerId: string): Promise<number> {
  const offered = await prisma.booking.findMany({
    where: {
      status: 'AWAITING_CLEANER',
      NOT: { declinedCleanerIds: { has: cleanerId } },
      OR: [
        { cleanerId, cascadePhase: { in: ['PRIMARY_OFFER', 'COMBINED_OFFER'] } },
        {
          backupCleanerIds: { has: cleanerId },
          cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'RENA_FIND', 'PHASE2_RESERVE'] },
        },
      ],
    },
    select: { id: true },
  });
  let released = 0;
  for (const b of offered) {
    const r = await handleDecline(b.id, cleanerId).catch(() => null);
    if (r?.success) released++;
  }
  return released;
}

// ─── Decline ───────────────────────────────────────────────────

export interface DeclineResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  message?: string;
}

export async function handleDecline(
  bookingId: string,
  cleanerId: string,
  /** B3: the shell's optional reason, written in the same statement. */
  reason?: string
): Promise<DeclineResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      cascadeBackupExpiresAt: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
    },
  });

  if (!booking) return { success: false, error: 'Booking not found', statusCode: 404 };
  if (booking.status !== 'AWAITING_CLEANER') {
    return { success: false, error: 'Booking is not awaiting a cleaner', statusCode: 400 };
  }
  if (!booking.cascadePhase) {
    return { success: false, error: 'No active cascade on this booking', statusCode: 400 };
  }

  const isPrimary = booking.cleanerId === cleanerId;
  const isBackup = booking.backupCleanerIds.includes(cleanerId);

  if (!isPrimary && !isBackup) {
    return { success: false, error: 'You are not offered this booking', statusCode: 403 };
  }
  if ((booking.declinedCleanerIds ?? []).includes(cleanerId)) {
    return { success: false, error: 'Already declined', statusCode: 400 };
  }

  // B3 (RENA-028): ONE guarded statement records the decline (and its
  // reason) only while the row is still in the phase this read saw and the
  // cleaner has not already declined. Zero rows means the sweep, an accept or
  // another decline moved first: nothing is advanced from this stale read.
  const entry = reason
    ? JSON.stringify([{ cleanerId, reason, at: new Date().toISOString() }])
    : null;
  const written = await prisma.$executeRaw`
    UPDATE "Booking"
       SET "declinedCleanerIds" = array_append("declinedCleanerIds", ${cleanerId}),
           "declineReasons" = CASE
             WHEN ${entry}::jsonb IS NULL THEN "declineReasons"
             ELSE COALESCE("declineReasons", '[]'::jsonb) || ${entry}::jsonb
           END,
           "updatedAt" = now()
     WHERE id = ${bookingId}
       AND status = 'AWAITING_CLEANER'::"BookingStatus"
       AND "cascadePhase" = ${booking.cascadePhase}::"CascadePhase"
       AND NOT (${cleanerId} = ANY("declinedCleanerIds"))`;
  if (written === 0) {
    return {
      success: false,
      error: 'This offer changed a moment ago — refresh to see where it stands.',
      statusCode: 409,
    };
  }

  if (booking.cascadePhase === 'PRIMARY_OFFER' && isPrimary) {
    await advanceFromPrimary(bookingId, booking);
    return { success: true, message: 'Declined — offered to backup cleaners.' };
  }

  if (booking.cascadePhase === 'BACKUP_OFFER' || booking.cascadePhase === 'COMBINED_OFFER') {
    // Best-effort immediate-exhaust check; scheduler is the guaranteed backstop (#5)
    await checkAllDeclined(bookingId, booking.cascadePhase);
    return { success: true, message: 'Declined.' };
  }

  // H27 (James law): a broadcast whose recipient set is provably exhausted
  // terminates NOW — refund + email — never at window expiry. These two
  // phases were built expiry-terminal only: declines were recorded with no
  // consequence, so a 2-cleaner platform held the customer's money for days
  // against an impossible outcome.
  if (booking.cascadePhase === 'RENA_FIND') {
    await checkBroadcastExhausted(bookingId);
    return { success: true, message: 'Declined.' };
  }

  if (booking.cascadePhase === 'PHASE2_RESERVE') {
    await checkReserveExhausted(bookingId);
    return { success: true, message: 'Declined.' };
  }

  return { success: true, message: 'Declined.' };
}

// H27: after EVERY broadcast decline, evaluate remaining-offerable =
// (recipients − decliners) still genuinely free per the SHARED slot predicate.
// Empty → the outcome is impossible → exhaust immediately through the same
// terminal expiry uses (expireRenaFind: CASCADE_EXHAUSTED → auto-refund +
// notify + email, the H17-fixed path). The scheduler expiry stays as backstop.
// Applies identically to cascade-entered and rescue-①-entered broadcasts —
// both terminate in an automatic full refund when nobody can take the slot.
async function checkBroadcastExhausted(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      cascadePhase: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
    },
  });
  if (!booking || booking.status !== 'AWAITING_CLEANER' || booking.cascadePhase !== 'RENA_FIND') {
    return;
  }

  const remaining = booking.backupCleanerIds.filter(
    (id) => !(booking.declinedCleanerIds ?? []).includes(id)
  );
  if (remaining.length > 0) {
    const slotFree = await filterSlotAvailableCleaners(remaining, {
      date: booking.date,
      startTime: booking.startTime,
      durationHours: Number(booking.duration),
      excludeBookingId: bookingId,
    });
    if (slotFree.size > 0) return; // someone can still accept — broadcast lives
  }

  const exhausted = await expireRenaFind(bookingId);
  if (exhausted) {
    await AuditService.log({
      action: 'RENA_FIND_EXHAUSTED_ON_DECLINE',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        recipients: booking.backupCleanerIds.length,
        declined: (booking.declinedCleanerIds ?? []).length,
        remainingAfterDecline: remaining.length,
      },
    }).catch(() => {});
  }
}

// H27 (rule 4): the ordinary cascade's Phase-2 shares the broadcast shape —
// every offered cleaner declining with NO live reserve means the reserve
// window can never produce a promotion. Run the promotion path NOW: with zero
// priceable reserves it exhausts immediately (which itself widens to
// Rena-Find or refunds, per the consent flag).
async function checkReserveExhausted(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      cascadePhase: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      reserveCleanerIds: true,
    },
  });
  if (
    !booking ||
    booking.status !== 'AWAITING_CLEANER' ||
    booking.cascadePhase !== 'PHASE2_RESERVE'
  ) {
    return;
  }

  const declined = booking.declinedCleanerIds ?? [];
  const allDeclined = booking.backupCleanerIds.every((id) => declined.includes(id));
  // H66 (Harry's law): reserve promotion needs a trigger on EVERY pool-state
  // change, not just timers. When the pool ahead (the backups) has fully
  // declined, run the promotion path NOW — promoteReserves itself promotes the
  // best live reserve, or exhausts when none remain. The old condition only
  // handled the exhaust arm (zero live reserves), so a live reserve — the
  // customer's last candidate — sat in hold until the phase-2 timer.
  if (allDeclined) {
    await promoteReserves(bookingId);
  }
}

async function checkAllDeclined(bookingId: string, phase: CascadePhase): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      cascadePhase: true,
      status: true,
    },
  });
  if (!booking || booking.status !== 'AWAITING_CLEANER') return;

  // #4: phase-dependent offered set
  const offeredSet =
    booking.cascadePhase === 'COMBINED_OFFER'
      ? [booking.cleanerId, ...booking.backupCleanerIds]
      : booking.backupCleanerIds;

  const allDeclined = offeredSet.every((id) => (booking.declinedCleanerIds ?? []).includes(id));
  if (!allDeclined) return;

  await handleCascadeExhaustion(bookingId, phase);
}

// ─── Atomic accept ─────────────────────────────────────────────

export interface AcceptResult {
  success: boolean;
  reason?: string;
  /** B3: the assignment helper's refusal, when the claim itself was refused. */
  code?: AssignFailure;
}

function acceptRefusal(reason: AssignFailure): AcceptResult {
  return { success: false, reason: ASSIGN_FAILURE_MESSAGE[reason], code: reason };
}

export async function atomicAccept(bookingId: string, cleanerId: string): Promise<AcceptResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      clientId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      paymentStatus: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
  // H38: belt-and-braces against the self-review exploit through the offer
  // door — the booking's CUSTOMER may never accept their own job, whatever
  // set they somehow appear in.
  if (booking.clientId === cleanerId) {
    return { success: false, reason: "This is your own booking — you can't accept it." };
  }
  // H53: NO PAYMENT → NO ACCEPT. Belt-and-braces at the money door — a phantom
  // offer that somehow reached a cleaner can never be accepted while unpaid.
  if (booking.paymentStatus === 'PENDING' || booking.paymentStatus === 'FAILED') {
    return { success: false, reason: 'This booking has not been paid for yet.' };
  }

  if (booking.status !== 'AWAITING_CLEANER') {
    return { success: false, reason: 'Booking is no longer available' };
  }
  if (!booking.cascadePhase) {
    return { success: false, reason: 'No active cascade on this booking' };
  }

  const isPrimary = booking.cleanerId === cleanerId;
  const isBackup = booking.backupCleanerIds.includes(cleanerId);

  if (booking.cascadePhase === 'PRIMARY_OFFER' && !isPrimary) {
    return { success: false, reason: 'Only the primary cleaner can accept in this phase' };
  }
  if (booking.cascadePhase === 'BACKUP_OFFER' && !isBackup) {
    return { success: false, reason: 'Only backup cleaners can accept in this phase' };
  }
  if (booking.cascadePhase === 'COMBINED_OFFER' && !isPrimary && !isBackup) {
    return { success: false, reason: 'You are not offered this booking' };
  }
  if (booking.cascadePhase === 'PHASE2_RESERVE' && !isBackup) {
    return { success: false, reason: 'Only backup cleaners can accept in this phase' };
  }
  if ((booking.declinedCleanerIds ?? []).includes(cleanerId)) {
    return { success: false, reason: 'You already declined this booking' };
  }

  // H7 + B3 (RENA-012, RENA-030): the accepter's real diary is re-read and the
  // claim made inside one transaction under the cleaner's advisory lock, with
  // the offer window enforced in the CAS (the booking itself is excluded so a
  // primary can't self-conflict).
  const claim = await assignCleaner({
    bookingId,
    cleanerId,
    expect: { status: 'AWAITING_CLEANER', cascadePhase: booking.cascadePhase },
    requireUnexpiredOffer: true,
    data: {
      status: 'ACCEPTED',
      cleanerId,
      acceptedAt: new Date(),
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      reserveCleanerIds: [],
    },
    actor: { kind: 'CLEANER', id: cleanerId },
  });
  if (!claim.ok) return acceptRefusal(claim.reason);

  // Booking confirmed — schedule the reminder series (best-effort; never blocks
  // the accept). The atomic guard above ensures this runs exactly once.
  await BookingReminderService.scheduleReminders(bookingId).catch(() => {});

  // H15: the customer learns WHO took their clean, on every accept path —
  // living here (not the routes) so no caller can forget it. ESSENTIAL, so
  // never quiet-hours gated; guests get their tokened link.
  await sendCleanerAcceptedBooking(bookingId).catch(() => {});
  // F8: the CLEANER's confirmation with the .ics calendar attachment.
  await sendCleanerJobAccepted(bookingId).catch(() => {});

  // Best-effort loser notifications
  const losers = getLoserSet(booking, cleanerId);
  for (const loserId of losers) {
    await prisma.notification
      .create({
        data: {
          userId: loserId,
          type: 'SYSTEM',
          title: 'Job no longer available',
          body: 'This cleaning job was just taken by another cleaner.',
          data: { bookingId },
        },
      })
      .catch(() => {});
  }

  return { success: true };
}

// ─── Rena-find atomic accept (A5.5) ──────────────────────────────
//
// Separate from atomicAccept: qualification = membership in
// backupCleanerIds (the Rena-find broadcast set). No reconciliation —
// Rena-find is accepted at the paid price.

export async function renaFindAccept(bookingId: string, cleanerId: string): Promise<AcceptResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      paymentStatus: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
  // H38: belt-and-braces against the self-review exploit through the offer
  // door — the booking's CUSTOMER may never accept their own job, whatever
  // set they somehow appear in.
  if (booking.clientId === cleanerId) {
    return { success: false, reason: "This is your own booking — you can't accept it." };
  }
  // B3 (James-ruled): the H53 money door atomicAccept has — no payment, no accept.
  if (booking.paymentStatus === 'PENDING' || booking.paymentStatus === 'FAILED') {
    return { success: false, reason: 'This booking has not been paid for yet.' };
  }

  if (booking.status !== 'AWAITING_CLEANER') {
    return { success: false, reason: 'Booking is no longer available' };
  }
  if (booking.cascadePhase !== 'RENA_FIND') {
    return { success: false, reason: 'This booking is not in the Rena-find phase' };
  }
  if (!booking.backupCleanerIds.includes(cleanerId)) {
    return { success: false, reason: 'You are not offered this booking' };
  }
  if ((booking.declinedCleanerIds ?? []).includes(cleanerId)) {
    return { success: false, reason: 'You already declined this booking' };
  }

  // H7 + B3: same locked re-validation and claim as atomicAccept.
  const claim = await assignCleaner({
    bookingId,
    cleanerId,
    expect: { status: 'AWAITING_CLEANER', cascadePhase: 'RENA_FIND' },
    requireUnexpiredOffer: true,
    data: {
      status: 'ACCEPTED',
      cleanerId,
      acceptedAt: new Date(),
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      reserveCleanerIds: [],
    },
    actor: { kind: 'CLEANER', id: cleanerId },
  });
  if (!claim.ok) return acceptRefusal(claim.reason);

  // Booking confirmed via Rena-find — schedule the reminder series (best-effort).
  await BookingReminderService.scheduleReminders(bookingId).catch(() => {});

  // H15: same acceptance-moment email — covers Rena-Find AND rescue-① accepts.
  await sendCleanerAcceptedBooking(bookingId).catch(() => {});
  // F8: cleaner confirmation + .ics on this accept path too.
  await sendCleanerJobAccepted(bookingId).catch(() => {});

  const losers = booking.backupCleanerIds.filter(
    (id) => id !== cleanerId && !(booking.declinedCleanerIds ?? []).includes(id)
  );
  for (const loserId of losers) {
    await prisma.notification
      .create({
        data: {
          userId: loserId,
          type: 'SYSTEM',
          title: 'Job no longer available',
          body: 'This cleaning job was just taken by another cleaner.',
          data: { bookingId },
        },
      })
      .catch(() => {});
  }

  return { success: true };
}

// ─── Canonical PROVISIONAL_APPROVAL entry (A5.3 Stage 3) ──────────
//
// Single source of truth for the field set written when a booking enters
// PROVISIONAL_APPROVAL. All entry points — cascade provisional accept,
// reserve promotion, and admin reassign — write THIS exact set so they
// cannot drift. (Previously atomicProvisionalAccept and promoteReserves
// drifted: the former set cascadeBackupExpiresAt:null + relied on the
// topupApproved default; the latter omitted cascadeBackupExpiresAt + set
// topupApproved:false. Unifying is behavior-preserving — see the call
// sites for the per-caller proof.)
function provisionalEntryData(args: {
  provisionalCleanerId: string;
  provisionalPrice: number;
  topupAmount: number;
  approvalExpiresAt: Date;
  source: 'CASCADE' | 'ADMIN_REASSIGN' | 'ADMIN_PRICE_ADJUST';
  reserveCleanerIds?: string[];
}) {
  return {
    cascadePhase: 'PROVISIONAL_APPROVAL' as const,
    provisionalCleanerId: args.provisionalCleanerId,
    provisionalPrice: args.provisionalPrice,
    topupAmount: args.topupAmount,
    approvalExpiresAt: args.approvalExpiresAt,
    cascadeExpiresAt: args.approvalExpiresAt,
    cascadeBackupExpiresAt: null,
    topupApproved: false,
    reserveCleanerIds: args.reserveCleanerIds ?? [],
    provisionalSource: args.source,
  };
}

// ─── Atomic provisional accept (A5.3) ─────────────────────────

export interface ProvisionalAcceptResult {
  success: boolean;
  reason?: string;
  approvalExpiresAt?: Date;
}

export async function atomicProvisionalAccept(
  bookingId: string,
  cleanerId: string,
  pricing: {
    provisionalPrice: number;
    topupAmount: number;
    approvalExpiresAt: Date;
  }
): Promise<ProvisionalAcceptResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      clientId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
  // H38: belt-and-braces against the self-review exploit through the offer
  // door — the booking's CUSTOMER may never accept their own job, whatever
  // set they somehow appear in.
  if (booking.clientId === cleanerId) {
    return { success: false, reason: "This is your own booking — you can't accept it." };
  }

  if (booking.status !== 'AWAITING_CLEANER') {
    return { success: false, reason: 'Booking is no longer available' };
  }
  if (!booking.cascadePhase) {
    return { success: false, reason: 'No active cascade on this booking' };
  }

  const isBackup = booking.backupCleanerIds.includes(cleanerId);
  const isPrimary = booking.cleanerId === cleanerId;

  if (booking.cascadePhase === 'PRIMARY_OFFER' && !isPrimary) {
    return { success: false, reason: 'Only the primary cleaner can accept in this phase' };
  }
  if (booking.cascadePhase === 'BACKUP_OFFER' && !isBackup) {
    return { success: false, reason: 'Only backup cleaners can accept in this phase' };
  }
  if (booking.cascadePhase === 'COMBINED_OFFER' && !isPrimary && !isBackup) {
    return { success: false, reason: 'You are not offered this booking' };
  }
  if ((booking.declinedCleanerIds ?? []).includes(cleanerId)) {
    return { success: false, reason: 'You already declined this booking' };
  }

  // H7 + B3 — a provisional accept is still an assignment path: the lock and
  // the slot check run for the provisional cleaner (cleanerId is unchanged).
  const claim = await assignCleaner({
    bookingId,
    cleanerId,
    expect: { status: 'AWAITING_CLEANER', cascadePhase: booking.cascadePhase },
    requireUnexpiredOffer: true,
    // Unified entry. Net change vs before: +topupApproved:false (no-op —
    // default false, never flipped at first provisional), +reserveCleanerIds:[]
    // (no-op — empty pre-Phase-2), +provisionalSource:'CASCADE' (new field).
    data: provisionalEntryData({
      provisionalCleanerId: cleanerId,
      provisionalPrice: pricing.provisionalPrice,
      topupAmount: pricing.topupAmount,
      approvalExpiresAt: pricing.approvalExpiresAt,
      source: 'CASCADE',
    }),
    actor: { kind: 'CLEANER', id: cleanerId },
  });
  if (!claim.ok) {
    return { success: false, reason: ASSIGN_FAILURE_MESSAGE[claim.reason] };
  }

  // Loser notifications
  const losers = getLoserSet(booking, cleanerId);
  for (const loserId of losers) {
    await prisma.notification
      .create({
        data: {
          userId: loserId,
          type: 'SYSTEM',
          title: 'Job no longer available',
          body: 'This cleaning job was just taken by another cleaner.',
          data: { bookingId },
        },
      })
      .catch(() => {});
  }

  return { success: true, approvalExpiresAt: pricing.approvalExpiresAt };
}

// ─── Phase 2: hold a pricier cleaner in reserve (A5.3 Stage 2) ───
//
// In PHASE2_RESERVE, a backup who would be pricier than the paid price is
// NOT provisionally accepted — they're held in reserve. They only get
// promoted (cheapest-first) if no at-or-below cleaner accepts.

export interface ReserveResult {
  success: boolean;
  reason?: string;
  alreadyReserved?: boolean;
}

export async function addToReserve(bookingId: string, cleanerId: string): Promise<ReserveResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      clientId: true,
      cascadePhase: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      reserveCleanerIds: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
  // H38: belt-and-braces against the self-review exploit through the offer
  // door — the booking's CUSTOMER may never accept their own job, whatever
  // set they somehow appear in.
  if (booking.clientId === cleanerId) {
    return { success: false, reason: "This is your own booking — you can't accept it." };
  }

  if (booking.status !== 'AWAITING_CLEANER' || booking.cascadePhase !== 'PHASE2_RESERVE') {
    return { success: false, reason: 'This booking is no longer accepting reserves' };
  }
  if (!booking.backupCleanerIds.includes(cleanerId)) {
    return { success: false, reason: 'You are not offered this booking' };
  }
  if ((booking.declinedCleanerIds ?? []).includes(cleanerId)) {
    return { success: false, reason: 'You already declined this booking' };
  }
  if (booking.reserveCleanerIds.includes(cleanerId)) {
    return { success: true, alreadyReserved: true };
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: 'PHASE2_RESERVE',
      NOT: { reserveCleanerIds: { has: cleanerId } },
    },
    data: { reserveCleanerIds: { push: cleanerId } },
  });

  if (result.count === 0) {
    return {
      success: false,
      reason: 'This booking was just taken or is no longer accepting reserves.',
    };
  }

  return { success: true };
}

function getLoserSet(
  booking: Pick<Booking, 'cleanerId' | 'backupCleanerIds' | 'cascadePhase' | 'declinedCleanerIds'>,
  winnerId: string
): string[] {
  let offeredSet: string[];

  if (booking.cascadePhase === 'COMBINED_OFFER') {
    offeredSet = [booking.cleanerId, ...booking.backupCleanerIds];
  } else if (booking.cascadePhase === 'BACKUP_OFFER' || booking.cascadePhase === 'PHASE2_RESERVE') {
    offeredSet = [...booking.backupCleanerIds];
  } else {
    return [];
  }

  return offeredSet.filter(
    (id) => id !== winnerId && !(booking.declinedCleanerIds ?? []).includes(id)
  );
}

// ─── Per-booking expiry functions ──────────────────────────────
//
// Each function handles one cascade-phase expiry for a single booking.
// Used by the scheduler (batch) and by the admin force-advance endpoint
// (single booking). Same atomic claims, same transitions.

export async function expirePrimaryOffer(
  bookingId: string,
  booking: BookingCascadeData
): Promise<boolean> {
  await advanceFromPrimary(bookingId, booking);
  return true;
}

export async function expireBackupOrCombinedOffer(
  bookingId: string,
  currentPhase: 'BACKUP_OFFER' | 'COMBINED_OFFER'
): Promise<boolean> {
  return handleCascadeExhaustion(bookingId, currentPhase);
}

export async function expireProvisionalApproval(bookingId: string): Promise<boolean> {
  // A refused admin revert is not an advance: the booking stays put and the
  // admins were alerted, so no customer comms go out here.
  const advanced = (await handleProvisionalFailure(bookingId, 'Approval window expired')) === true;
  // R10 Lane 1 (James-ruled): the customer hears the release moment itself,
  // honestly PER CASCADE PATH. When the advance keeps the search alive the
  // notice promises the next step; when it exhausted the cascade, the
  // exhaustion flow's own comms (refund, honest ending) carry that moment —
  // a "we are still working on it" here would be a lie, so it is skipped.
  // Bell + email, best-effort, never blocks the sweep.
  if (advanced) {
    try {
      const b = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true, date: true, status: true },
      });
      if (b && ['CASCADE_EXHAUSTED', 'CANCELLED'].includes(b.status)) {
        return advanced;
      }
      // B3: a top-up taken whose assignment was refused makes "nothing has
      // been charged" untrue; that customer hears from the team instead.
      if (await hasTopupWithoutAssignment(bookingId)) return advanced;
      if (b?.clientId) {
        await prisma.notification
          .create({
            data: {
              userId: b.clientId,
              type: 'SYSTEM',
              title: 'The price change window has closed',
              body: 'The approval window closed before a decision was made, so that offer has been released. Nothing has been charged. We are still working on your booking and will send you the next step.',
              data: { bookingId, url: `/booking/${bookingId}` },
            },
          })
          .catch(() => {});
      }
      const { sendTopupWindowClosed } = await import('./email.service');
      await sendTopupWindowClosed(bookingId).catch(() => {});
    } catch {
      // comms only — the cascade advance already happened
    }
  }
  return advanced;
}

// ─── Phase 2: Reserve promotion (A5.3 Stage 2) ───────────────
//
// Unified failure handler for provisional approvals. Decides:
//   phase2Entered == false → enter Phase 2 (at-or-below sub-window)
//   phase2Entered == true  → advance to next-cheapest reserve

export async function handleProvisionalFailure(
  bookingId: string,
  reason: string
): Promise<boolean | typeof REASSIGN_REVERT_CONFLICT> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      cascadePhase: true,
      phase2Entered: true,
      provisionalCleanerId: true,
      provisionalSource: true,
      date: true,
      startTime: true,
      duration: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      serviceType: true,
      clientId: true,
    },
  });
  if (!b || b.status !== 'AWAITING_CLEANER' || b.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    return false;
  }

  // Admin-initiated provisional → revert to prior cleaner/state, do NOT
  // continue the cascade (no Phase 2, no reserve advance). H54: the
  // price-adjust source reverts identically — decline/expiry leaves the
  // booking intact at its old price with its cleaner (James ruling d).
  if (b.provisionalSource === 'ADMIN_REASSIGN' || b.provisionalSource === 'ADMIN_PRICE_ADJUST') {
    return revertAdminReassign(bookingId, reason);
  }

  const failedCleaner = b.provisionalCleanerId;
  const topupRecordStatus = reason.includes('declined') ? 'DECLINED' : 'EXPIRED';

  if (!b.phase2Entered) {
    // FIRST failure → enter Phase 2
    const phase2Window = computePhase2Window(new Date(), b.date, b.startTime);

    const res = await prisma.booking.updateMany({
      where: { id: bookingId, status: 'AWAITING_CLEANER', cascadePhase: 'PROVISIONAL_APPROVAL' },
      data: {
        cascadePhase: 'PHASE2_RESERVE',
        phase2Entered: true,
        cascadeExpiresAt: phase2Window,
        cascadeBackupExpiresAt: null,
        provisionalCleanerId: null,
        provisionalPrice: null,
        topupAmount: null,
        approvalExpiresAt: null,
        topupApproved: false,
        ...(failedCleaner ? { declinedCleanerIds: { push: failedCleaner } } : {}),
      },
    });
    if (res.count > 0) {
      await prisma.topupRecord.updateMany({
        where: { bookingId, status: { in: ['PENDING', 'UNKNOWN'] } },
        data: { status: topupRecordStatus, failureReason: reason },
      });
      await AuditService.log({
        action: 'PHASE2_ENTERED',
        entityType: 'Booking',
        entityId: bookingId,
        metadata: { reason, failedCleaner },
      }).catch(() => {});
      await reopenToBackups(bookingId, b);
      return true;
    }
    return false;
  }

  // SUBSEQUENT failure (already in Phase 2) → advance to next-cheapest reserve
  const res = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'AWAITING_CLEANER', cascadePhase: 'PROVISIONAL_APPROVAL' },
    data: {
      cascadePhase: 'PHASE2_RESERVE',
      cascadeExpiresAt: new Date(),
      provisionalCleanerId: null,
      provisionalPrice: null,
      topupAmount: null,
      approvalExpiresAt: null,
      topupApproved: false,
      ...(failedCleaner ? { declinedCleanerIds: { push: failedCleaner } } : {}),
    },
  });
  if (res.count > 0) {
    await prisma.topupRecord.updateMany({
      where: { bookingId, status: { in: ['PENDING', 'UNKNOWN'] } },
      data: { status: topupRecordStatus, failureReason: reason },
    });
    await promoteReserves(bookingId);
    return true;
  }
  return false;
}

function computePhase2Window(now: Date, bookingDate: Date, startTime: string): Date {
  const slotStart = parseSlotStart(bookingDate, startTime);
  const slotMinus24h = slotStart
    ? new Date(slotStart.getTime() - 24 * HOUR_MS)
    : new Date(now.getTime() + 6 * HOUR_MS);
  const sixHours = new Date(now.getTime() + 6 * HOUR_MS);
  return new Date(Math.min(sixHours.getTime(), slotMinus24h.getTime()));
}

function computePhase2ApprovalWindow(now: Date, bookingDate: Date, startTime: string): Date {
  return computePhase2Window(now, bookingDate, startTime);
}

async function reopenToBackups(
  bookingId: string,
  booking: Pick<
    Booking,
    | 'backupCleanerIds'
    | 'declinedCleanerIds'
    | 'serviceType'
    | 'clientId'
    | 'date'
    | 'startTime'
    | 'duration'
  > & {
    provisionalCleanerId: string | null;
  }
): Promise<void> {
  const declined = new Set([
    ...(booking.declinedCleanerIds ?? []),
    ...(booking.provisionalCleanerId ? [booking.provisionalCleanerId] : []),
  ]);
  const notDeclined = booking.backupCleanerIds.filter((id) => !declined.has(id));
  // H7: this is an offer firing — only genuinely slot-free backups are invited
  // (the accept-time guard backstops anyone who slips through via a stale list).
  const availableSet = await filterSlotAvailableCleaners(notDeclined, {
    date: booking.date,
    startTime: booking.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: bookingId,
  });
  const activeBackups = notDeclined.filter((id) => availableSet.has(id));

  // H66: phase-2 entry with NOBODY to re-offer is a pool-state where no decline
  // event can ever arrive — the old code told the customer "reopened to backup
  // cleaners" with zero backups and left any reserve waiting on the timer.
  // Promote immediately instead (promoteReserves promotes or exhausts) and
  // skip the reopened-comms lie.
  if (activeBackups.length === 0) {
    await promoteReserves(bookingId);
    return;
  }

  for (const backupId of activeBackups) {
    await prisma.notification
      .create({
        data: {
          userId: backupId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${serviceLabelFromSlug(booking.serviceType)} job is available — accept if you can take it at or below the quoted price.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // F11 extension (James-ruled): the Phase-2 reopen is an offer — same email
  // as every other offer, to the same pruned active set.
  await sendBackupOfferEmails(bookingId, activeBackups).catch(() => {});
  // 1.0.1 cargo: native offer push per reopened-offer recipient.
  for (const backupId of activeBackups) {
    await EnhancedNotificationService.sendNewOfferPush(bookingId, backupId).catch(() => {});
  }

  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'SYSTEM',
          title: 'Still searching for a cleaner',
          body: "The price approval didn't go through — we've reopened this to backup cleaners at or below the original price.",
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // X1: back to searching — email both audiences.
  await sendCascadeSearchingUpdate(bookingId).catch(() => {});
}

export async function promoteReserves(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      cascadePhase: true,
      reserveCleanerIds: true,
      declinedCleanerIds: true,
      serviceType: true,
      propertySize: true,
      duration: true,
      extras: true,
      totalPrice: true,
      clientId: true,
      date: true,
      startTime: true,
      client: { select: { email: true, name: true } },
    },
  });
  if (!booking) return false;
  if (booking.status !== 'AWAITING_CLEANER' || booking.cascadePhase !== 'PHASE2_RESERVE') {
    return false;
  }

  const notDeclined = booking.reserveCleanerIds.filter(
    (id) => !(booking.declinedCleanerIds ?? []).includes(id)
  );
  // H7: promotion is an assignment path — only reserves still free for the slot
  // are priced/promoted. Unavailable reserves stay in the pool (their diary may
  // clear before the next promotion attempt).
  const reserveAvailable = await filterSlotAvailableCleaners(notDeclined, {
    date: booking.date,
    startTime: booking.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: booking.id,
  });
  const eligible = notDeclined.filter((id) => reserveAvailable.has(id));

  let pricingSlug: ReturnType<typeof normalizeToPricingSlug>;
  try {
    pricingSlug = normalizeToPricingSlug(booking.serviceType);
  } catch {
    await exhaustFromPhase2(bookingId);
    return true;
  }

  const propertySize = booking.propertySize
    ? propertySizeEnumToSlug(booking.propertySize as PropertySize)
    : undefined;

  const priced: { cleanerId: string; total: number }[] = [];
  for (const cid of eligible) {
    try {
      const q = await pricingService.calculateQuote({
        cleanerId: cid,
        serviceSlug: pricingSlug as ServiceSlug,
        hours: Number(booking.duration),
        propertySize,
        addons: booking.extras,
      });
      priced.push({ cleanerId: cid, total: q.customerTotal });
    } catch {
      // Un-quotable reserve — skip
    }
  }

  if (priced.length === 0) {
    await exhaustFromPhase2(bookingId);
    return true;
  }

  priced.sort((a, b) => a.total - b.total);
  const winner = priced[0];
  const topupAmount = Math.round((winner.total - Number(booking.totalPrice)) * 100) / 100;
  const remaining = booking.reserveCleanerIds.filter((id) => id !== winner.cleanerId);
  const approvalExpiresAt = computePhase2ApprovalWindow(
    new Date(),
    booking.date,
    booking.startTime
  );

  // B3: the promotion claims under the winner's lock with a locked slot
  // re-read. No offer-window check: promotion is the system acting at or after
  // the reserve window's end (the sweep calls it on expiry), not a cleaner
  // answering a live offer. A lost slot leaves the phase for the next tick,
  // whose pre-filter skips the winner. B3 gate condition (James-ruled): the
  // promotion always writes a new explicit expiry (cascadeExpiresAt and
  // approvalExpiresAt, both from a window computed now), and the acceptance
  // that follows, the customer's approve, is still refused server-side once
  // that expiry passes (approve-topup POST, 410).
  const claim = await assignCleaner({
    bookingId,
    cleanerId: winner.cleanerId,
    expect: { status: 'AWAITING_CLEANER', cascadePhase: 'PHASE2_RESERVE' },
    requireUnexpiredOffer: false,
    // Unified entry. Net change vs before: +cascadeBackupExpiresAt:null
    // (PROVEN no-op — cascadeBackupExpiresAt is already null in every path
    // that reaches promoteReserves; first-failure entry into PHASE2_RESERVE
    // sets it null and nothing re-sets it non-null), +provisionalSource:'CASCADE'
    // (new field). All other fields identical.
    data: provisionalEntryData({
      provisionalCleanerId: winner.cleanerId,
      provisionalPrice: winner.total,
      topupAmount,
      approvalExpiresAt,
      source: 'CASCADE',
      reserveCleanerIds: remaining,
    }),
    actor: { kind: 'SYSTEM' },
  });
  if (!claim.ok) return false;

  await AuditService.log({
    action: 'PHASE2_RESERVE_PROMOTED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { cleanerId: winner.cleanerId, price: winner.total, topupAmount, remaining },
  }).catch(() => {});

  // F5: sender resolves registered vs guest recipient (guests get tokened links).
  await sendTopupApprovalRequest({
    bookingId,
    originalPrice: Number(booking.totalPrice),
    newPrice: winner.total,
    topupAmount,
    expiresAt: approvalExpiresAt,
  }).catch(() => {});
  await notifyTopupApprovalRequested(bookingId, topupAmount).catch(() => {});
  return true;
}

async function exhaustFromPhase2(bookingId: string): Promise<void> {
  const entered = await handleCascadeExhaustion(bookingId, 'PHASE2_RESERVE');
  if (entered) {
    await AuditService.log({
      action: 'PHASE2_EXHAUSTED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {},
    }).catch(() => {});
  }
}

// ─── Admin reassign: pricier path (A5.3 Stage 3) ─────────────────
//
// Enters PROVISIONAL_APPROVAL via the SAME canonical field set as the
// cascade (provisionalEntryData), tagged source:'ADMIN_REASSIGN', plus
// status→AWAITING_CLEANER and the durable revert anchors. cleanerId is
// NOT changed here — it stays the old cleaner until writeTopupSuccess
// swaps it on payment success (mirrors the cascade exactly).

export interface AdminReassignProvisionalResult {
  success: boolean;
  reason?: string;
  approvalExpiresAt?: Date;
}

export async function enterAdminReassignProvisional(args: {
  bookingId: string;
  newCleanerId: string;
  provisionalPrice: number;
  topupAmount: number;
  originalPrice: number;
  previousStatus: BookingStatus;
  previousCleanerId: string;
  eligibleStatuses: BookingStatus[];
  bookingDate: Date;
  startTime: string;
  customerEmail: string | null;
  customerName: string | null;
}): Promise<AdminReassignProvisionalResult> {
  // Same 6h-capped-at-slot−24h window as Phase 2 (James decision 3).
  const approvalExpiresAt = computePhase2Window(new Date(), args.bookingDate, args.startTime);

  // Atomic claim — same TECHNIQUE as cascade (updateMany + count check). The
  // predicate intentionally does NOT guard cascadePhase: admin override wins
  // over any phase, including an in-flight cascade PROVISIONAL_APPROVAL. The
  // money guard (transferStatus) hard-blocks post-release. eligibleStatuses
  // bounds which source states an admin may reassign from.
  // R10 TOCTOU fix (same law as enterAdminPriceAdjust): pin the claim to the
  // EXACT previously-read status and cleaner, so the revert snapshot can
  // never store a stale value — a concurrent flip aborts with count 0.
  if (!args.eligibleStatuses.includes(args.previousStatus)) {
    return { success: false, reason: 'Booking state changed — reload and try again' };
  }
  // B3: through the assignment helper — the lock and the locked slot check
  // run for the NEW (provisional) cleaner, who must genuinely be free.
  const claim = await assignCleaner({
    bookingId: args.bookingId,
    cleanerId: args.newCleanerId,
    expect: { status: args.previousStatus, cleanerId: args.previousCleanerId },
    expectWhere: { transferStatus: { in: ['PENDING', 'FAILED'] } },
    requireUnexpiredOffer: false,
    // Admin placements may sit outside template hours (as before); only a
    // true double booking refuses.
    slotPolicy: 'overlap',
    actor: { kind: 'ADMIN' },
    data: {
      status: 'AWAITING_CLEANER',
      reassignPreviousStatus: args.previousStatus,
      reassignPreviousCleanerId: args.previousCleanerId,
      ...provisionalEntryData({
        provisionalCleanerId: args.newCleanerId,
        provisionalPrice: args.provisionalPrice,
        topupAmount: args.topupAmount,
        approvalExpiresAt,
        source: 'ADMIN_REASSIGN',
      }),
    },
  });
  if (!claim.ok) {
    return {
      success: false,
      reason:
        claim.reason === 'SLOT_TAKEN'
          ? 'The new cleaner is not free at that time — reassign aborted'
          : 'Booking changed state — reassign aborted',
    };
  }

  await AuditService.log({
    action: 'ADMIN_REASSIGN_PROVISIONAL',
    entityType: 'Booking',
    entityId: args.bookingId,
    metadata: {
      newCleanerId: args.newCleanerId,
      provisionalPrice: args.provisionalPrice,
      topupAmount: args.topupAmount,
      previousCleanerId: args.previousCleanerId,
      previousStatus: args.previousStatus,
    },
  }).catch(() => {});

  // F5: sender resolves registered vs guest recipient (guests get tokened links).
  await sendTopupApprovalRequest({
    bookingId: args.bookingId,
    customerEmail: args.customerEmail || undefined,
    customerName: args.customerName || undefined,
    originalPrice: args.originalPrice,
    newPrice: args.provisionalPrice,
    topupAmount: args.topupAmount,
    expiresAt: approvalExpiresAt,
  }).catch(() => {});
  await notifyTopupApprovalRequested(args.bookingId, args.topupAmount).catch(() => {});

  return { success: true, approvalExpiresAt };
}

// ─── H54: admin price adjust (same cleaner, delta only) ───────────────────
//
// James rulings: (a) approval restores the booking's PRE-ADJUST status (the
// exact CONFIRMED/ACCEPTED it held — via reassignPreviousStatus, same restore
// rail as reassign); (b) live paid bookings only, never while a cascade is in
// flight (cascadePhase must be null at entry — the atomic claim enforces it);
// (c) money splits proportionally — writeTopupSuccess scales every money field
// by newTotal/oldTotal, so the cleaner keeps the same share of the delta;
// (d) decline/expiry reverts to the old price + status via revertAdminReassign
// (the customer's booking is untouched if they say no).
//
// The customer sees the existing approve page, which shows the DELTA only —
// executeTopup charges topupAmount, never the total.
export async function enterAdminPriceAdjust(args: {
  bookingId: string;
  topupAmount: number; // the DELTA in pounds, > 0
  adminId: string;
  reason: string;
}): Promise<AdminReassignProvisionalResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    select: {
      status: true,
      cascadePhase: true,
      cleanerId: true,
      clientId: true,
      totalPrice: true,
      date: true,
      startTime: true,
      client: { select: { email: true, name: true } },
    },
  });
  if (!booking) return { success: false, reason: 'Booking not found' };
  if (!booking.clientId) {
    return { success: false, reason: 'Guest bookings cannot approve top-ups' };
  }

  const delta = Math.round(args.topupAmount * 100) / 100;
  if (!Number.isFinite(delta) || delta <= 0) {
    return { success: false, reason: 'Adjustment amount must be a positive number' };
  }

  const originalPrice = Number(booking.totalPrice);
  const provisionalPrice = Math.round((originalPrice + delta) * 100) / 100;
  const approvalExpiresAt = computePhase2Window(new Date(), booking.date, booking.startTime);

  // R4 LANE 5B (James-ruled): refuse born-dead windows. When the slot is
  // already inside its 24-hour guard, the window computes in the past — the
  // old path created the adjust anyway, emailed "approximately 1 hour", and
  // the customer's approve met a 410. The admin is told at creation instead.
  if (approvalExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return {
      success: false,
      reason:
        'Too close to the visit. The approval window (which closes 24h before the slot) would already be shut. Arrange the change with the customer directly, or adjust an occurrence further out.',
    };
  }

  // Atomic claim: LIVE paid bookings only — CONFIRMED/ACCEPTED, no cascade in
  // flight, funds not yet released. Same guarded-updateMany technique as the
  // cascade; a concurrent state change makes count 0 and we abort.
  // R10 TOCTOU fix (James's law, from the 4a footnote): the revert snapshot
  // (reassignPreviousStatus/CleanerId) used to store values read BEFORE the
  // claim while the WHERE admitted the whole claimable set — a flip between
  // read and claim stored a stale revert value. The WHERE now pins the EXACT
  // read values: unchanged reality claims and the snapshot is true by
  // construction; changed reality makes count 0 and aborts honestly.
  if (booking.status !== 'CONFIRMED' && booking.status !== 'ACCEPTED') {
    return { success: false, reason: 'Only live CONFIRMED/ACCEPTED bookings can be adjusted' };
  }
  const claim = await prisma.booking.updateMany({
    where: {
      id: args.bookingId,
      status: booking.status,
      cleanerId: booking.cleanerId,
      cascadePhase: null,
      paymentStatus: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
      transferStatus: { in: ['PENDING', 'FAILED'] },
    },
    data: {
      status: 'AWAITING_CLEANER',
      reassignPreviousStatus: booking.status,
      reassignPreviousCleanerId: booking.cleanerId,
      ...provisionalEntryData({
        provisionalCleanerId: booking.cleanerId,
        provisionalPrice,
        topupAmount: delta,
        approvalExpiresAt,
        source: 'ADMIN_PRICE_ADJUST',
      }),
    },
  });
  if (claim.count === 0) {
    return {
      success: false,
      reason:
        'Booking is not adjustable (must be live, paid, no cascade in flight, funds unreleased)',
    };
  }

  await AuditService.log({
    userId: args.adminId,
    action: 'ADMIN_PRICE_ADJUST_REQUESTED',
    entityType: 'Booking',
    entityId: args.bookingId,
    metadata: {
      topupAmount: delta,
      originalPrice,
      provisionalPrice,
      reason: args.reason,
    },
  }).catch(() => {});

  // Same delta-only approval email the reassign flow sends (guest-safe sender —
  // though guests are blocked above, registered customers get their link).
  await sendTopupApprovalRequest({
    bookingId: args.bookingId,
    customerEmail: booking.client?.email || undefined,
    customerName: booking.client?.name || undefined,
    originalPrice,
    newPrice: provisionalPrice,
    topupAmount: delta,
    expiresAt: approvalExpiresAt,
    // R4 LANE 5B: honest copy — this is a price adjust, not a cleaner swap,
    // and the admin's typed reason travels to the customer.
    provisionalSource: 'ADMIN_PRICE_ADJUST',
    adminReason: args.reason,
  }).catch(() => {});
  await notifyTopupApprovalRequested(args.bookingId, delta, 'ADMIN_PRICE_ADJUST').catch(() => {});

  return { success: true, approvalExpiresAt };
}

/**
 * B3 gate (James-ruled): an admin revert whose original cleaner has lost the
 * slot is refused, never written. The booking stays in its reassignment or
 * provisional state, the refusal is audited and every admin gets an urgent
 * bell. B4 adds the REASSIGN_REVERT_CONFLICT queue state that holds it.
 */
export const REASSIGN_REVERT_CONFLICT = 'REASSIGN_REVERT_CONFLICT' as const;

// Revert an admin-reassign provisional on customer decline / expiry / charge
// fail. Restores the EXACT pre-reassign state (status + cleaner). For a
// CASCADE_EXHAUSTED booking this returns it to CASCADE_EXHAUSTED (James
// decision 1). Atomic + idempotent: count===0 ⇒ no-op.
async function revertAdminReassign(
  bookingId: string,
  reason: string
): Promise<boolean | typeof REASSIGN_REVERT_CONFLICT> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      reassignPreviousStatus: true,
      reassignPreviousCleanerId: true,
      provisionalCleanerId: true,
      clientId: true,
      // R4 LANE 5B: captured BEFORE the revert clears it — the copy fork
      // (adjust vs reassign) depends on it.
      provisionalSource: true,
      approvalExpiresAt: true,
    },
  });
  if (!b?.reassignPreviousStatus || !b.reassignPreviousCleanerId) return false;
  const wasAdjust = b.provisionalSource === 'ADMIN_PRICE_ADJUST';
  // B3: the revert's customer copy says nothing was charged; when a top-up
  // was taken but its assignment refused that is untrue, so the copy is held
  // and the team (stuck-money page) speaks instead.
  const moneyTaken = await hasTopupWithoutAssignment(bookingId);
  const wasDeclined = reason.includes('declined');

  // B3: the restore moves the row back into the blocking set for the previous
  // cleaner, whose slot was open to others during the approval window, so it
  // runs through the assignment helper: the cleaner's lock, the I1 overlap
  // re-read, then the CAS. A lost slot refuses the restore (James-ruled).
  const res = await assignCleaner({
    bookingId,
    cleanerId: b.reassignPreviousCleanerId,
    expect: {
      status: 'AWAITING_CLEANER',
      cascadePhase: 'PROVISIONAL_APPROVAL',
      reassignPreviousCleanerId: b.reassignPreviousCleanerId,
    },
    expectWhere: {
      // H54: both admin-initiated provisional sources revert the same way.
      provisionalSource: { in: ['ADMIN_REASSIGN', 'ADMIN_PRICE_ADJUST'] },
    },
    requireUnexpiredOffer: false,
    slotPolicy: 'overlap',
    actor: { kind: 'SYSTEM' },
    data: {
      status: b.reassignPreviousStatus,
      cleanerId: b.reassignPreviousCleanerId,
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      provisionalCleanerId: null,
      provisionalPrice: null,
      topupAmount: null,
      approvalExpiresAt: null,
      topupApproved: false,
      provisionalSource: null,
      reassignPreviousStatus: null,
      reassignPreviousCleanerId: null,
    },
  });
  if (!res.ok) {
    if (res.reason !== 'SLOT_TAKEN') return false;
    await raiseRevertConflict({
      bookingId,
      cleanerId: b.reassignPreviousCleanerId,
      reason,
      episode: b.approvalExpiresAt?.toISOString() ?? 'none',
    });
    return REASSIGN_REVERT_CONFLICT;
  }

  // R4 LANE 5A (James-ruled): the fence extends to top-ups — cancel the
  // on-session PaymentIntent at Stripe BEFORE the record sweep (cancel-first
  // discipline), so a late card entry from an open tab can never charge
  // against a booking that no longer carries the adjustment. Fail-soft LOUD:
  // a failed cancel never blocks the revert, but every failure is audited
  // (a PI that already succeeded throws here — the webhook race owns that
  // path and the audit row records it happened).
  const cancellable = await prisma.topupRecord.findMany({
    where: {
      bookingId,
      status: { in: ['PENDING', 'UNKNOWN'] },
      paymentMethodType: 'on_session',
      stripePaymentIntentId: { not: null },
    },
    select: { id: true, stripePaymentIntentId: true },
  });
  for (const rec of cancellable) {
    try {
      await stripe.paymentIntents.cancel(rec.stripePaymentIntentId as string, {
        cancellation_reason: 'abandoned',
      });
    } catch (err) {
      await AuditService.log({
        action: 'TOPUP_PI_CANCEL_FAILED',
        entityType: 'TopupRecord',
        entityId: rec.id,
        metadata: {
          bookingId,
          paymentIntentId: rec.stripePaymentIntentId,
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {});
    }
  }

  await prisma.topupRecord
    .updateMany({
      where: { bookingId, status: { in: ['PENDING', 'UNKNOWN'] } },
      data: { status: reason.includes('declined') ? 'DECLINED' : 'EXPIRED', failureReason: reason },
    })
    .catch(() => {});

  await AuditService.log({
    action: 'ADMIN_REASSIGN_REVERTED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      reason,
      restoredStatus: b.reassignPreviousStatus,
      restoredCleanerId: b.reassignPreviousCleanerId,
      rejectedCleanerId: b.provisionalCleanerId,
    },
  }).catch(() => {});

  // Notify the rejected (new) cleaner + customer (best-effort)
  if (b.provisionalCleanerId) {
    await prisma.notification
      .create({
        data: {
          userId: b.provisionalCleanerId,
          type: 'SYSTEM',
          title: 'Reassignment not proceeding',
          body: 'The customer did not approve the price change, so this job will not be reassigned to you.',
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  if (b.clientId && !moneyTaken) {
    // R4 LANE 5B: the bell tells the true story — adjust vs reassign, and
    // declined vs expired are different sentences.
    const title = wasAdjust
      ? wasDeclined
        ? 'Price change declined'
        : 'Price change expired'
      : 'Reassignment not going ahead';
    const body = wasAdjust
      ? wasDeclined
        ? 'Nothing was charged. Your booking is unchanged. Same cleaner, same time, original price.'
        : 'The approval window passed and nothing was charged. Your booking is unchanged. Same cleaner, same time, original price.'
      : wasDeclined
        ? 'You declined the price change, so nothing was charged. Your booking returns to how it was.'
        : 'The approval window passed, and nothing was charged. Your booking returns to how it was.';
    await prisma.notification
      .create({
        data: {
          userId: b.clientId,
          type: 'SYSTEM',
          title,
          body,
          data: { bookingId },
        },
      })
      .catch(() => {});
  }

  // R4 LANE 5B: the revert email — this leg was bell-row-only before.
  if (!moneyTaken) {
    await sendTopupRevertNotice({
      bookingId,
      declined: wasDeclined,
      isAdjust: wasAdjust,
    }).catch(() => {});
  }

  return true;
}

/**
 * The refusal's audit row and urgent admin alert. The expiry sweep retries
 * the revert every tick (a slot that frees again lets it land), so the alert
 * is raised once per provisional episode (keyed on its approval expiry); the
 * error log line is written on every refusal.
 */
async function raiseRevertConflict(args: {
  bookingId: string;
  cleanerId: string;
  reason: string;
  episode: string;
}): Promise<void> {
  log.error('cascade', 'admin_revert_refused_slot_taken', {
    bookingId: args.bookingId,
    cleanerId: args.cleanerId,
  });
  const already = await prisma.auditLog.count({
    where: {
      entityId: args.bookingId,
      action: 'ADMIN_REASSIGN_REVERT_REFUSED',
      metadata: { path: ['episode'], equals: args.episode },
    },
  });
  if (already > 0) return;
  await AuditService.log({
    action: 'ADMIN_REASSIGN_REVERT_REFUSED',
    entityType: 'Booking',
    entityId: args.bookingId,
    metadata: {
      code: REASSIGN_REVERT_CONFLICT,
      previousCleanerId: args.cleanerId,
      trigger: args.reason,
      episode: args.episode,
    },
  }).catch(() => {});
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  const ref = args.bookingId.substring(0, 8).toUpperCase();
  for (const admin of admins) {
    await prisma.notification
      .create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Urgent: reassignment could not be reverted',
          body: `Booking ${ref}: the original cleaner is no longer free at that time, so the booking was not returned to them. It stays in its reassignment state until someone resolves it.`,
          data: {
            bookingId: args.bookingId,
            severity: 'high',
            code: REASSIGN_REVERT_CONFLICT,
            url: `/admin/bookings/${args.bookingId}`,
          },
        },
      })
      .catch(() => {});
  }
}

/** B3: a top-up was charged but its assignment refused (flagged for B4). */
async function hasTopupWithoutAssignment(bookingId: string): Promise<boolean> {
  const n = await prisma.topupRecord.count({
    where: {
      bookingId,
      status: 'SUCCEEDED',
      failureReason: { startsWith: 'TOPUP_WITHOUT_ASSIGNMENT' },
    },
  });
  return n > 0;
}

// ─── Rena-find: cascade exhaustion → wider network (A5.5) ────────
//
// Canonical helper: all 4 exhaustion points route through here.
// autoAssignBackup=true  → RENA_FIND (broadcast to wider network)
// autoAssignBackup=false → CASCADE_EXHAUSTED (auto-refund in chunk 3)
// Slot-passed guard: skip Rena-find if booking date/time already passed.

async function handleCascadeExhaustion(
  bookingId: string,
  expectedPhase: CascadePhase
): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      autoAssignBackup: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
      clientId: true,
      cleanerId: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      cleanerEarnings: true,
      addressPostcode: true, // A12: postcode now lives on the booking
      address: { select: { postcode: true } }, // legacy fallback for pre-A12 rows
    },
  });
  if (!booking) return false;

  const now = new Date();
  const slotStart = parseSlotStart(booking.date, booking.startTime);
  const slotPassed = slotStart ? slotStart.getTime() <= now.getTime() : false;

  if (booking.autoAssignBackup && !slotPassed) {
    return enterRenaFind(bookingId, expectedPhase, booking, now);
  }

  return cascadeExhaust(bookingId, expectedPhase);
}

// ─── Auto-refund on cascade exhaustion (A5.5 chunk 3) ───────────
//
// Called inline from every path that sets CASCADE_EXHAUSTED. Full refund
// of the original charge, status → CANCELLED. Never throws — inline
// failure is caught by the scheduler safety sweep.

async function autoRefundExhausted(bookingId: string): Promise<boolean> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        totalAmountCharged: true,
        totalPrice: true,
        paymentStatus: true,
        status: true,
      },
    });
    if (!booking) return false;
    if (booking.status !== 'CASCADE_EXHAUSTED') return false;
    if (booking.paymentStatus !== 'SUCCEEDED' && booking.paymentStatus !== 'PARTIALLY_REFUNDED') {
      return false;
    }

    const refundAmount = Number(booking.totalAmountCharged ?? booking.totalPrice);
    if (refundAmount <= 0) return false;

    const result = await refundBooking(
      bookingId,
      refundAmount,
      'No cleaner available — fully refunded',
      {
        adjustEarnings: true,
        bookingDataOverride: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'No cleaner available — fully refunded',
        },
      }
    );

    return result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED';
  } catch (error) {
    log.error('cascade', 'auto_refund_failed', { provider: 'stripe', bookingId }, error);
    return false;
  }
}

async function cascadeExhaust(bookingId: string, expectedPhase: CascadePhase): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: expectedPhase,
    },
    data: {
      status: 'CASCADE_EXHAUSTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      reserveCleanerIds: [],
    },
  });
  if (result.count > 0) {
    // H17: the customer is told on BOTH outcomes — previously a SUCCESSFUL
    // auto-refund was the silent case (only the failure branch notified), so
    // the person whose booking just died heard nothing. The copy ("your full
    // refund is on its way") is true either way: inline success, or the
    // safety sweep retries a failed one.
    await autoRefundExhausted(bookingId);
    await notifyCustomerExhausted(bookingId);
    await emailCustomerExhausted(bookingId);
    return true;
  }
  return false;
}

async function enterRenaFind(
  bookingId: string,
  expectedPhase: CascadePhase,
  booking: Pick<
    Booking,
    | 'date'
    | 'startTime'
    | 'duration'
    | 'serviceType'
    | 'clientId'
    | 'cleanerId'
    | 'backupCleanerIds'
    | 'declinedCleanerIds'
    | 'cleanerEarnings'
    | 'addressPostcode'
  > & { address: { postcode: string } | null },
  now: Date
): Promise<boolean> {
  // A12: read the postcode from the booking column (legacy relation as fallback).
  const postcode = booking.addressPostcode || booking.address?.postcode;
  if (!postcode) {
    return cascadeExhaust(bookingId, expectedPhase);
  }

  // Rating floor: only broadcast to cleaners within 0.3 of the chosen
  // cleaner's rating. H23 (James design ruling): the floor anchors on the
  // blended stored rating — the SAME number customers see (native VISIBLE +
  // imported VERIFIED via updateStoredRating) — and review-EXISTENCE decides
  // whether it applies at all:
  //   · unreviewed CHOSEN cleaner → no floor (the stored column holds its
  //     default 0 for an unreviewed cleaner — "rated 0.0" and "never rated"
  //     were indistinguishable, and a floor anchored on nothing is dishonest);
  //   · unreviewed CANDIDATE → passes any floor while the platform is young
  //     (the founding cohort must be offerable — revisit at review density).
  const primaryProfile = await prisma.cleanerProfile.findUnique({
    where: { userId: booking.cleanerId },
    select: { rating: true },
  });
  const primaryRating = primaryProfile ? Number(primaryProfile.rating) : 0;

  const slotStart = parseSlotStart(booking.date, booking.startTime);
  const resolveBy = slotStart
    ? new Date(slotStart.getTime() - 24 * HOUR_MS)
    : new Date(now.getTime() + 12 * HOUR_MS);
  const runwayMs = resolveBy.getTime() - now.getTime();
  const expiresAt = runwayMs > 0 ? resolveBy : new Date(now.getTime() + 12 * HOUR_MS);

  // H38: the booking's CUSTOMER is never a broadcast candidate — a
  // cleaner-customer must not be offered their own job.
  const excludeSet = new Set(
    [
      booking.cleanerId,
      booking.clientId,
      ...booking.backupCleanerIds,
      ...(booking.declinedCleanerIds ?? []),
    ].filter((x): x is string => !!x)
  );

  // H9: availability filter OFF here too — the H7 slot predicate below is the
  // single availability truth (findMatches' recurring-only gate would drop
  // cleaners with date-specific slots that the picker/search shows).
  const matchResult = await MatchingService.findMatches({
    date: booking.date,
    startTime: booking.startTime,
    duration: Number(booking.duration),
    serviceType: booking.serviceType,
    postcode,
    clientId: booking.clientId ?? undefined,
    skipAvailabilityFilter: true,
  });

  const eligible = matchResult.matches.filter((m) => !excludeSet.has(m.userId));
  const [slotFree, reviewCounts] = await Promise.all([
    filterSlotAvailableCleaners(
      eligible.map((m) => m.userId),
      {
        date: booking.date,
        startTime: booking.startTime,
        durationHours: Number(booking.duration),
        excludeBookingId: bookingId,
      }
    ),
    getReviewCounts([booking.cleanerId, ...eligible.map((m) => m.userId)]),
  ]);
  const chosenReviewed = (reviewCounts.get(booking.cleanerId) ?? 0) > 0;
  const ratingFloor = chosenReviewed ? primaryRating - 0.3 : null;
  const passesFloor = (m: { userId: string; rating: number }) =>
    ratingFloor === null || (reviewCounts.get(m.userId) ?? 0) === 0 || m.rating >= ratingFloor;
  const qualifiedIds = eligible
    .filter((m) => slotFree.has(m.userId) && passesFloor(m))
    .map((m) => m.userId);

  if (qualifiedIds.length === 0) {
    // H23: metadata now separates the three excluders so an empty broadcast is
    // diagnosable from the audit row alone — how many candidates matching
    // produced, how many survived the slot predicate, how many the floor cut.
    const belowFloorCount = eligible.filter((m) => !passesFloor(m)).length;
    return enterRenaFindAdminReview(bookingId, expectedPhase, booking.clientId, {
      primaryRating,
      ratingFloor,
      chosenReviewed,
      belowFloorCount,
      totalCandidates: matchResult.totalCandidates,
      eligibleCount: eligible.length,
      slotFreeCount: slotFree.size,
    });
  }

  // H21 consent law, enforced AT THE WRITE: the exhaustion-side RENA_FIND
  // broadcast may only ever fire for a booking whose customer opted in at
  // booking time. handleCascadeExhaustion already routes flag-false bookings
  // to cascadeExhaust, but this claim makes the law structural — no future
  // caller can broadcast without consent. (The rescue-① writer in
  // rescue.service.ts is deliberately NOT flag-gated: the customer's live
  // panel choice IS the consent there.)
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: expectedPhase,
      autoAssignBackup: true,
    },
    data: {
      cascadePhase: 'RENA_FIND',
      cascadeExpiresAt: expiresAt,
      cascadeBackupExpiresAt: null,
      backupCleanerIds: qualifiedIds,
      declinedCleanerIds: [],
      reserveCleanerIds: [],
    },
  });

  if (result.count === 0) return false;

  const earnings = `£${Number(booking.cleanerEarnings).toFixed(2)}`;
  for (const cleanerId of qualifiedIds) {
    await prisma.notification
      .create({
        data: {
          userId: cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${serviceLabelFromSlug(booking.serviceType)} job is available for ${earnings} — first to accept gets it.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // F11 extension (James-ruled): the Rena-Find broadcast is an offer — a
  // cleaner who'd get an email as a backup gets the same one as a broadcast
  // recipient. qualifiedIds is the pruned, qualified set.
  await sendBackupOfferEmails(bookingId, qualifiedIds).catch(() => {});
  // 1.0.1 cargo: native offer push per broadcast recipient.
  for (const cid of qualifiedIds) {
    await EnhancedNotificationService.sendNewOfferPush(bookingId, cid).catch(() => {});
  }

  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'SYSTEM',
          title: 'Searching for available cleaners',
          body: "Your chosen cleaners couldn't take this booking — we're searching our wider network for a suitable cleaner.",
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // X1: searching → Rena-Find sends the concierge reassurance — both audiences.
  await sendRenaFindConcierge(bookingId).catch(() => {});

  await AuditService.log({
    action: 'RENA_FIND_ENTERED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { candidateCount: qualifiedIds.length, expiresAt: expiresAt.toISOString() },
  }).catch(() => {});

  return true;
}

export async function expireRenaFind(bookingId: string): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: 'RENA_FIND',
    },
    data: {
      status: 'CASCADE_EXHAUSTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
    },
  });
  if (result.count > 0) {
    // H17: the customer is told on BOTH outcomes — previously a SUCCESSFUL
    // auto-refund was the silent case (only the failure branch notified), so
    // the person whose booking just died heard nothing. The copy ("your full
    // refund is on its way") is true either way: inline success, or the
    // safety sweep retries a failed one.
    await autoRefundExhausted(bookingId);
    await notifyCustomerExhausted(bookingId);
    await emailCustomerExhausted(bookingId);
    return true;
  }
  return false;
}

async function enterRenaFindAdminReview(
  bookingId: string,
  expectedPhase: CascadePhase,
  clientId: string | null,
  metadata: {
    primaryRating: number;
    ratingFloor: number | null;
    chosenReviewed: boolean;
    belowFloorCount: number;
    totalCandidates: number;
    eligibleCount: number;
    slotFreeCount: number;
  }
): Promise<boolean> {
  // H21: same consent-at-the-write guard as enterRenaFind — the admin-review
  // queue is the Rena-Find waiting room, so a booking without the booking-time
  // opt-in may never be parked in it either.
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: expectedPhase,
      autoAssignBackup: true,
    },
    data: {
      cascadePhase: 'RENA_FIND_ADMIN_REVIEW',
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      reserveCleanerIds: [],
    },
  });

  if (result.count === 0) return false;

  if (clientId) {
    await prisma.notification
      .create({
        data: {
          userId: clientId,
          type: 'SYSTEM',
          title: 'Finding you a cleaner',
          body: "We're reviewing options to find you a suitable cleaner — our team will be in touch shortly.",
          data: { bookingId },
        },
      })
      .catch(() => {});
  }
  // P2 (ledger): the admin-review waiting room belled but never EMAILED — the
  // one Rena-Find state with no written reassurance. Same concierge email as
  // the broadcast entry (guest-safe, ESSENTIAL); a booking that passed through
  // broadcast first may receive it twice, which is acceptable reassurance.
  await sendRenaFindConcierge(bookingId).catch(() => {});

  await AuditService.log({
    action: 'RENA_FIND_ADMIN_REVIEW_ENTERED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata,
  }).catch(() => {});

  return true;
}

// ─── Scheduler: process expired windows ────────────────────────

const SCHEDULER_BATCH_LIMIT = 50;

export async function processExpiredCascadeWindows(): Promise<{ processed: number }> {
  const now = new Date();

  const expired = await prisma.booking.findMany({
    where: {
      status: 'AWAITING_CLEANER',
      cascadePhase: { not: null },
      cascadeExpiresAt: { lt: now },
    },
    select: {
      id: true,
      cascadePhase: true,
      cleanerId: true,
      backupCleanerIds: true,
      cascadeBackupExpiresAt: true,
      declinedCleanerIds: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
      provisionalCleanerId: true,
    },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let processed = 0;

  for (const booking of expired) {
    try {
      if (booking.cascadePhase === 'PRIMARY_OFFER') {
        await expirePrimaryOffer(booking.id, booking);
        processed++;
      } else if (
        booking.cascadePhase === 'BACKUP_OFFER' ||
        booking.cascadePhase === 'COMBINED_OFFER'
      ) {
        const advanced = await expireBackupOrCombinedOffer(booking.id, booking.cascadePhase);
        if (advanced) processed++;
      } else if (booking.cascadePhase === 'PROVISIONAL_APPROVAL') {
        const advanced = await expireProvisionalApproval(booking.id);
        if (advanced) processed++;
      } else if (booking.cascadePhase === 'PHASE2_RESERVE') {
        const advanced = await promoteReserves(booking.id);
        if (advanced) processed++;
      } else if (booking.cascadePhase === 'RENA_FIND') {
        const advanced = await expireRenaFind(booking.id);
        if (advanced) processed++;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Cascade] Error processing booking ${booking.id}:`, error);
    }
  }

  if (expired.length === SCHEDULER_BATCH_LIMIT) {
    // eslint-disable-next-line no-console
    console.warn(`[Cascade] Hit batch limit (${SCHEDULER_BATCH_LIMIT}) — more bookings next tick`);
  }

  // ── Backstop: RENA_FIND_ADMIN_REVIEW bookings whose slot has passed ──
  // cascadeExpiresAt is null for admin-review, so the query above won't catch them.
  // Key off booking date instead — if the date is today or earlier, check the slot.
  const staleAdminReview = await prisma.booking.findMany({
    where: {
      status: 'AWAITING_CLEANER',
      cascadePhase: 'RENA_FIND_ADMIN_REVIEW',
      date: { lte: now },
    },
    select: { id: true, date: true, startTime: true },
    take: SCHEDULER_BATCH_LIMIT,
  });

  for (const booking of staleAdminReview) {
    try {
      const slotStart = parseSlotStart(booking.date, booking.startTime);
      if (!slotStart || slotStart.getTime() > now.getTime()) continue;

      const res = await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: 'AWAITING_CLEANER',
          cascadePhase: 'RENA_FIND_ADMIN_REVIEW',
        },
        data: {
          status: 'CASCADE_EXHAUSTED',
          cascadePhase: null,
          cascadeExpiresAt: null,
          cascadeBackupExpiresAt: null,
        },
      });
      if (res.count > 0) {
        // H17: notify on both refund outcomes (see cascadeExhaust).
        await autoRefundExhausted(booking.id);
        await notifyCustomerExhausted(booking.id);
        await emailCustomerExhausted(booking.id);
        processed++;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Cascade] Error processing admin-review backstop ${booking.id}:`, error);
    }
  }

  return { processed };
}

// ─── Safety sweep: refund stranded CASCADE_EXHAUSTED bookings ────
//
// Catches any CASCADE_EXHAUSTED booking where the inline refund failed
// (Stripe error, crash, etc.) or was skipped (payment not yet SUCCEEDED
// at inline time but completed since). Runs every scheduler tick.

export async function processExhaustedRefunds(): Promise<{ processed: number }> {
  const unrefunded = await prisma.booking.findMany({
    where: {
      status: 'CASCADE_EXHAUSTED',
      paymentStatus: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] },
      transferStatus: { in: ['PENDING', 'FAILED'] },
    },
    select: { id: true },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let processed = 0;
  for (const booking of unrefunded) {
    try {
      const refunded = await autoRefundExhausted(booking.id);
      if (refunded) processed++;
    } catch (error) {
      log.error(
        'cascade',
        'safety_sweep_refund_failed',
        { provider: 'stripe', bookingId: booking.id },
        error
      );
    }
  }
  return { processed };
}

// ─── Notifications (best-effort, fire-and-forget) ──────────────

// H57 addendum: every top-up approval request ALSO rings the bell — the email
// alone stranded logged-out customers (registered accounts only; guests have
// no bell and keep their tokened email link).
export async function notifyTopupApprovalRequested(
  bookingId: string,
  topupAmount: number,
  // R4 LANE 5B: source-aware copy — an adjust keeps the cleaner, and the row
  // says so; the swap story stays for reassign/cascade sources.
  source?: 'ADMIN_PRICE_ADJUST' | 'ADMIN_REASSIGN' | 'CASCADE'
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, serviceType: true, date: true },
  });
  if (!booking?.clientId) return;

  const isAdjust = source === 'ADMIN_PRICE_ADJUST';
  await prisma.notification
    .create({
      data: {
        userId: booking.clientId,
        type: 'SYSTEM',
        title: 'Price change needs your review',
        body: isAdjust
          ? `A price change of +£${topupAmount.toFixed(2)} has been proposed for your booking on ${booking.date.toISOString().split('T')[0]}. Your cleaner and time stay the same, and nothing is charged unless you approve.`
          : `A price change of +£${topupAmount.toFixed(2)} has been proposed for your booking on ${booking.date.toISOString().split('T')[0]}. Nothing is charged unless you approve.`,
        data: { bookingId, url: `/booking/${bookingId}/approve-topup` },
      },
    })
    .catch(() => {});
}

async function notifyCustomerExhausted(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true },
  });
  if (!booking?.clientId) return;

  await prisma.notification
    .create({
      data: {
        userId: booking.clientId,
        type: 'SYSTEM',
        title: 'No cleaner available',
        body: "Unfortunately none of our cleaners could take this booking. We're processing your refund — you'll receive confirmation shortly.",
        data: { bookingId },
      },
    })
    .catch(() => {});
}

// X1: the exhausted email goes to BOTH audiences (the in-app row above is
// registered-only by nature). Called alongside notifyCustomerExhausted.
export async function emailCustomerExhausted(bookingId: string): Promise<void> {
  await sendCascadeExhaustedRefund(bookingId).catch(() => {});
}
