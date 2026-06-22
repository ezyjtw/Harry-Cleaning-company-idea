/**
 * A5.1 Cascade offer service.
 *
 * Manages the primary → backup → exhausted cascade for direct-assignment bookings.
 * All state transitions use atomic updateMany with phase+status guards so that
 * concurrent requests (two backups accepting, scheduler + decline, etc.) can never
 * double-advance or corrupt state.
 */

import type { Booking, BookingStatus, CascadePhase, PropertySize } from '@prisma/client';

import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { sendTopupApprovalRequest } from './email.service';
import { MatchingService } from './matching.service';
import { pricingService } from './pricing.service';
import type { ServiceSlug } from './pricing.service';

// ─── Window computation ────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;

function parseSlotStart(bookingDate: Date, startTime: string): Date | null {
  try {
    const parts = startTime.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1] ?? 0);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const slot = new Date(bookingDate);
    slot.setUTCHours(hours, minutes, 0, 0);
    return slot;
  } catch {
    return null;
  }
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
  | 'serviceType'
>;

async function advanceFromPrimary(bookingId: string, booking: BookingCascadeData): Promise<void> {
  if (booking.backupCleanerIds.length === 0) {
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
    },
  });

  if (result.count === 0) return;

  const activeBackups = booking.backupCleanerIds.filter(
    (id) => !(booking.declinedCleanerIds ?? []).includes(id)
  );
  for (const backupId of activeBackups) {
    await prisma.notification
      .create({
        data: {
          userId: backupId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${booking.serviceType} job is available — first to accept gets it.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
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
}

// ─── Decline ───────────────────────────────────────────────────

export interface DeclineResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  message?: string;
}

export async function handleDecline(bookingId: string, cleanerId: string): Promise<DeclineResult> {
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

  // Atomic push — Prisma generates array_append(), safe under concurrency
  await prisma.booking.update({
    where: { id: bookingId },
    data: { declinedCleanerIds: { push: cleanerId } },
  });

  if (booking.cascadePhase === 'PRIMARY_OFFER' && isPrimary) {
    await advanceFromPrimary(bookingId, booking);
    return { success: true, message: 'Declined — offered to backup cleaners.' };
  }

  if (booking.cascadePhase === 'BACKUP_OFFER' || booking.cascadePhase === 'COMBINED_OFFER') {
    // Best-effort immediate-exhaust check; scheduler is the guaranteed backstop (#5)
    await checkAllDeclined(bookingId, booking.cascadePhase);
    return { success: true, message: 'Declined.' };
  }

  return { success: true, message: 'Declined.' };
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
}

export async function atomicAccept(bookingId: string, cleanerId: string): Promise<AcceptResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      declinedCleanerIds: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
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

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: booking.cascadePhase,
    },
    data: {
      status: 'ACCEPTED',
      cleanerId,
      acceptedAt: new Date(),
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
      reserveCleanerIds: [],
    },
  });

  if (result.count === 0) {
    return { success: false, reason: 'This booking was just taken by another cleaner.' };
  }

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
  source: 'CASCADE' | 'ADMIN_REASSIGN';
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
      backupCleanerIds: true,
      cascadePhase: true,
      status: true,
      declinedCleanerIds: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
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

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: booking.cascadePhase,
    },
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
  });

  if (result.count === 0) {
    return { success: false, reason: 'This booking was just taken by another cleaner.' };
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
      cascadePhase: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      reserveCleanerIds: true,
    },
  });

  if (!booking) return { success: false, reason: 'Booking not found' };
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
  return handleProvisionalFailure(bookingId, 'Approval window expired');
}

// ─── Phase 2: Reserve promotion (A5.3 Stage 2) ───────────────
//
// Unified failure handler for provisional approvals. Decides:
//   phase2Entered == false → enter Phase 2 (at-or-below sub-window)
//   phase2Entered == true  → advance to next-cheapest reserve

export async function handleProvisionalFailure(
  bookingId: string,
  reason: string
): Promise<boolean> {
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
  // continue the cascade (no Phase 2, no reserve advance).
  if (b.provisionalSource === 'ADMIN_REASSIGN') {
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
  booking: Pick<Booking, 'backupCleanerIds' | 'declinedCleanerIds' | 'serviceType' | 'clientId'> & {
    provisionalCleanerId: string | null;
  }
): Promise<void> {
  const declined = new Set([
    ...(booking.declinedCleanerIds ?? []),
    ...(booking.provisionalCleanerId ? [booking.provisionalCleanerId] : []),
  ]);
  const activeBackups = booking.backupCleanerIds.filter((id) => !declined.has(id));

  for (const backupId of activeBackups) {
    await prisma.notification
      .create({
        data: {
          userId: backupId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${booking.serviceType} job is available — accept if you can take it at or below the quoted price.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
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

  const eligible = booking.reserveCleanerIds.filter(
    (id) => !(booking.declinedCleanerIds ?? []).includes(id)
  );

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

  const claim = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'AWAITING_CLEANER', cascadePhase: 'PHASE2_RESERVE' },
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
  });
  if (claim.count === 0) return false;

  await AuditService.log({
    action: 'PHASE2_RESERVE_PROMOTED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { cleanerId: winner.cleanerId, price: winner.total, topupAmount, remaining },
  }).catch(() => {});

  if (booking.client?.email) {
    await sendTopupApprovalRequest({
      bookingId,
      customerEmail: booking.client.email,
      customerName: booking.client.name || 'Customer',
      originalPrice: Number(booking.totalPrice),
      newPrice: winner.total,
      topupAmount,
      expiresAt: approvalExpiresAt,
    }).catch(() => {});
  }
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
  const claim = await prisma.booking.updateMany({
    where: {
      id: args.bookingId,
      status: { in: args.eligibleStatuses },
      transferStatus: { in: ['PENDING', 'FAILED'] },
    },
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
  if (claim.count === 0) {
    return { success: false, reason: 'Booking changed state — reassign aborted' };
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

  if (args.customerEmail) {
    await sendTopupApprovalRequest({
      bookingId: args.bookingId,
      customerEmail: args.customerEmail,
      customerName: args.customerName || 'Customer',
      originalPrice: args.originalPrice,
      newPrice: args.provisionalPrice,
      topupAmount: args.topupAmount,
      expiresAt: approvalExpiresAt,
    }).catch(() => {});
  }

  return { success: true, approvalExpiresAt };
}

// Revert an admin-reassign provisional on customer decline / expiry / charge
// fail. Restores the EXACT pre-reassign state (status + cleaner). For a
// CASCADE_EXHAUSTED booking this returns it to CASCADE_EXHAUSTED (James
// decision 1). Atomic + idempotent: count===0 ⇒ no-op.
async function revertAdminReassign(bookingId: string, reason: string): Promise<boolean> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      reassignPreviousStatus: true,
      reassignPreviousCleanerId: true,
      provisionalCleanerId: true,
      clientId: true,
    },
  });
  if (!b?.reassignPreviousStatus || !b.reassignPreviousCleanerId) return false;

  const res = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: 'PROVISIONAL_APPROVAL',
      provisionalSource: 'ADMIN_REASSIGN',
    },
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
  if (res.count === 0) return false;

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
  if (b.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: b.clientId,
          type: 'SYSTEM',
          title: 'Reassignment cancelled',
          body: 'The price change was declined — your booking is unchanged.',
          data: { bookingId },
        },
      })
      .catch(() => {});
  }

  return true;
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
      address: { select: { postcode: true } },
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
    await notifyCustomerExhausted(bookingId);
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
  > & { address: { postcode: string } | null },
  now: Date
): Promise<boolean> {
  const postcode = booking.address?.postcode;
  if (!postcode) {
    return cascadeExhaust(bookingId, expectedPhase);
  }

  // Rating floor: only broadcast to cleaners within 0.3 of primary's rating
  const primaryProfile = await prisma.cleanerProfile.findUnique({
    where: { userId: booking.cleanerId },
    select: { rating: true },
  });
  const primaryRating = primaryProfile ? Number(primaryProfile.rating) : 0;
  const ratingFloor = primaryRating - 0.3;

  const slotStart = parseSlotStart(booking.date, booking.startTime);
  const resolveBy = slotStart
    ? new Date(slotStart.getTime() - 24 * HOUR_MS)
    : new Date(now.getTime() + 12 * HOUR_MS);
  const runwayMs = resolveBy.getTime() - now.getTime();
  const expiresAt = runwayMs > 0 ? resolveBy : new Date(now.getTime() + 12 * HOUR_MS);

  const excludeSet = new Set([
    booking.cleanerId,
    ...booking.backupCleanerIds,
    ...(booking.declinedCleanerIds ?? []),
  ]);

  const matchResult = await MatchingService.findMatches({
    date: booking.date,
    startTime: booking.startTime,
    duration: Number(booking.duration),
    serviceType: booking.serviceType,
    postcode,
    clientId: booking.clientId ?? undefined,
  });

  const eligible = matchResult.matches.filter((m) => m.isAvailable && !excludeSet.has(m.userId));
  const qualifiedIds = eligible.filter((m) => m.rating >= ratingFloor).map((m) => m.userId);

  if (qualifiedIds.length === 0) {
    const belowFloorCount = eligible.filter((m) => m.rating < ratingFloor).length;
    return enterRenaFindAdminReview(bookingId, expectedPhase, booking.clientId, {
      primaryRating,
      ratingFloor,
      belowFloorCount,
      totalCandidates: matchResult.totalCandidates,
    });
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: expectedPhase,
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
          body: `A ${booking.serviceType} job is available for ${earnings} — first to accept gets it.`,
          data: { bookingId },
        },
      })
      .catch(() => {});
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
    await notifyCustomerExhausted(bookingId);
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
    ratingFloor: number;
    belowFloorCount: number;
    totalCandidates: number;
  }
): Promise<boolean> {
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: expectedPhase,
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
        await notifyCustomerExhausted(booking.id);
        processed++;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Cascade] Error processing admin-review backstop ${booking.id}:`, error);
    }
  }

  return { processed };
}

// ─── Notifications (best-effort, fire-and-forget) ──────────────

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
        body: "None of your chosen cleaners could take this booking. We're working on finding you a cleaner.",
        data: { bookingId },
      },
    })
    .catch(() => {});
}
