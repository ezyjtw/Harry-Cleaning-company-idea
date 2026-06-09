/**
 * A5.1 Cascade offer service.
 *
 * Manages the primary → backup → exhausted cascade for direct-assignment bookings.
 * All state transitions use atomic updateMany with phase+status guards so that
 * concurrent requests (two backups accepting, scheduler + decline, etc.) can never
 * double-advance or corrupt state.
 */

import type { Booking, CascadePhase } from '@prisma/client';

import prisma from '@/lib/db/prisma';

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
    const result = await prisma.booking.updateMany({
      where: { id: bookingId, status: 'AWAITING_CLEANER', cascadePhase: 'PRIMARY_OFFER' },
      data: {
        status: 'CASCADE_EXHAUSTED',
        cascadePhase: null,
        cascadeExpiresAt: null,
        cascadeBackupExpiresAt: null,
      },
    });
    if (result.count > 0) {
      await notifyCustomerExhausted(bookingId);
    }
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

  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: 'AWAITING_CLEANER',
      cascadePhase: phase,
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
  }
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

function getLoserSet(
  booking: Pick<Booking, 'cleanerId' | 'backupCleanerIds' | 'cascadePhase' | 'declinedCleanerIds'>,
  winnerId: string
): string[] {
  let offeredSet: string[];

  if (booking.cascadePhase === 'COMBINED_OFFER') {
    offeredSet = [booking.cleanerId, ...booking.backupCleanerIds];
  } else if (booking.cascadePhase === 'BACKUP_OFFER') {
    offeredSet = [...booking.backupCleanerIds];
  } else {
    return [];
  }

  return offeredSet.filter(
    (id) => id !== winnerId && !(booking.declinedCleanerIds ?? []).includes(id)
  );
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
    },
    take: SCHEDULER_BATCH_LIMIT,
  });

  let processed = 0;

  for (const booking of expired) {
    try {
      if (booking.cascadePhase === 'PRIMARY_OFFER') {
        await advanceFromPrimary(booking.id, booking);
        processed++;
      } else if (
        booking.cascadePhase === 'BACKUP_OFFER' ||
        booking.cascadePhase === 'COMBINED_OFFER'
      ) {
        const result = await prisma.booking.updateMany({
          where: {
            id: booking.id,
            status: 'AWAITING_CLEANER',
            cascadePhase: booking.cascadePhase,
          },
          data: {
            status: 'CASCADE_EXHAUSTED',
            cascadePhase: null,
            cascadeExpiresAt: null,
            cascadeBackupExpiresAt: null,
          },
        });
        if (result.count > 0) {
          await notifyCustomerExhausted(booking.id);
          processed++;
        }
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
