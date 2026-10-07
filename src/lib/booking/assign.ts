// B3.1 (RENA-012, RENA-030, RENA-028 half): THE assignment helper.
//
// assignCleaner is the only function allowed to write cleanerId on a row in
// the blocking status set (blocksCleanerSlotWhere) or to move a row into that
// set. Every writer for one cleaner serialises on a per-cleaner Postgres
// advisory lock, re-reads the row and the cleaner's diary INSIDE the locked
// transaction, then claims with a compare-and-swap. Because every writer holds
// the lock, a competing assignment is either committed (and visible to the
// re-read) or has not started.
//
// Invariant I1 (as implemented): for any cleaner, no two bookings with that
// cleanerId whose status blocks the slot overlap once the later one's start
// is pushed back by the cleaner's bookingBufferMinutes, i.e. every pair is at
// least the buffer apart, the same spacing the timesheet engine has always
// enforced. Intervals are real instants on the London clock, so the check
// holds across midnight and the clock changes. Flexible rows keep today's
// semantics: they neither block nor are blocked.
//
// Side effects (notifications, audit, email) belong to the caller and run
// only on ok: true.

import type { Booking, BookingStatus, CascadePhase, Prisma } from '@prisma/client';

import {
  blocksCleanerSlotWhere,
  filterSlotAvailableCleaners,
} from '@/lib/availability/slot-eligibility';
import prisma from '@/lib/db/prisma';
import { bookingStartUtc } from '@/lib/time/booking-time';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The interactive transaction client of the app's Prisma client. */
export type AssignTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Every given key must equal the row (compared in code and in the CAS WHERE). */
export interface AssignExpect {
  status?: BookingStatus;
  cascadePhase?: CascadePhase | null;
  cleanerId?: string;
  provisionalCleanerId?: string | null;
  reassignPreviousCleanerId?: string | null;
  date?: Date;
  startTime?: string;
}

export type AssignFailure = 'NOT_FOUND' | 'STATE_CHANGED' | 'OFFER_EXPIRED' | 'SLOT_TAKEN';

export type AssignResult =
  | { ok: true; booking: Booking; slotConflict: boolean }
  | { ok: false; reason: AssignFailure };

/**
 * diary:   the cleaner's diary must take the slot: open hours, time off and
 *          the I1 overlap read (SLOT_TAKEN otherwise). Cleaner accepts and
 *          customer choices, which were offered from that diary.
 * overlap: only the I1 overlap read must pass. Admin placements (which may
 *          sit outside template hours, as before) and the provisional
 *          finalise (money already taken: only a true double booking refuses).
 * skip:    the row already holds this cleaner's slot (a move inside the
 *          blocking set, same cleaner, same slot) or does not enter it, so
 *          the claim cannot change I1; the lock still serialises the write.
 * report:  the I1 read runs but the write proceeds and the result says so
 *          (used only by the admin revert, which restores the customer's
 *          original booking; see the caller).
 */
export type SlotPolicy = 'diary' | 'overlap' | 'skip' | 'report';

export interface AssignInput {
  bookingId: string;
  /** The cleaner whose slot is claimed: the lock key and the diary checked. */
  cleanerId: string;
  expect: AssignExpect;
  /** Extra guards applied only in the CAS write (e.g. transferStatus). */
  expectWhere?: Prisma.BookingWhereInput;
  /** cascadeExpiresAt IS NULL OR cascadeExpiresAt > now (RENA-030). */
  requireUnexpiredOffer: boolean;
  /** Default: the row's own slot. rescueRebook and the reschedules pass the new one. */
  slot?: { date: Date; startTime: string; durationHours: number };
  slotPolicy?: SlotPolicy;
  /** A further check under the lock (e.g. the reschedule's time-off read). */
  extraSlotCheck?: (tx: AssignTx, row: Booking) => Promise<boolean>;
  data: Prisma.BookingUncheckedUpdateManyInput;
  actor: { kind: 'CLEANER' | 'CUSTOMER' | 'ADMIN' | 'SYSTEM'; id?: string };
  now?: Date;
  /** Writes that must commit with the claim (e.g. the top-up record). */
  afterClaim?: (tx: AssignTx, booking: Booking) => Promise<void>;
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Serialise every writer for one cleaner (released at commit or rollback). */
export async function lockCleaner(tx: AssignTx, cleanerId: string): Promise<void> {
  const key = `cleaner:${cleanerId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/**
 * Inside the locked transaction: is this slot free for the cleaner? The
 * timesheet engine (open hours, time off, same-day bookings with the buffer,
 * pastness) plus an instant check against the cleaner's blocking bookings on
 * the neighbouring days, so a job crossing midnight is seen.
 */
export async function slotFreeForCleaner(
  tx: AssignTx,
  cleanerId: string,
  slot: { date: Date; startTime: string; durationHours: number },
  excludeBookingId?: string
): Promise<boolean> {
  const free = await filterSlotAvailableCleaners([cleanerId], { ...slot, excludeBookingId }, tx);
  if (!free.has(cleanerId)) return false;
  return (await blockingOverlap(tx, cleanerId, slot, excludeBookingId)) === null;
}

/**
 * The I1 read: the id of a blocking booking of this cleaner that the slot
 * would overlap (instants on the London clock, the cleaner's buffer between),
 * or null. Checks the neighbouring days so a job crossing midnight is seen.
 */
export async function blockingOverlap(
  tx: AssignTx,
  cleanerId: string,
  slot: { date: Date; startTime: string; durationHours: number },
  excludeBookingId?: string
): Promise<string | null> {
  const start = bookingStartUtc(slot.date, slot.startTime);
  if (!start) return null; // Flexible: today's semantics
  const end = start.getTime() + slot.durationHours * HOUR_MS;

  const profile = await tx.cleanerProfile.findUnique({
    where: { userId: cleanerId },
    select: { bookingBufferMinutes: true },
  });
  const bufferMs = (profile?.bookingBufferMinutes ?? 0) * MINUTE_MS;

  const neighbours = await tx.booking.findMany({
    where: {
      cleanerId,
      date: {
        gte: new Date(slot.date.getTime() - DAY_MS),
        lte: new Date(slot.date.getTime() + DAY_MS),
      },
      AND: [blocksCleanerSlotWhere()],
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true, date: true, startTime: true, duration: true },
  });
  for (const n of neighbours) {
    const s = bookingStartUtc(n.date, n.startTime);
    if (!s) continue; // Flexible rows neither block nor are blocked
    const e = s.getTime() + Number(n.duration) * HOUR_MS;
    if (start.getTime() < e + bufferMs && s.getTime() < end + bufferMs) return n.id;
  }
  return null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return a === b;
}

/**
 * Run fn inside one transaction holding the cleaner's lock. Used by the
 * recurring mint, which creates rows rather than updating one.
 */
export async function withCleanerLock<T>(
  cleanerId: string,
  fn: (tx: AssignTx) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockCleaner(tx, cleanerId);
    return fn(tx);
  }, TX_OPTIONS);
}

export async function assignCleaner(input: AssignInput): Promise<AssignResult> {
  const now = input.now ?? new Date();
  const policy = input.slotPolicy ?? 'diary';

  return prisma.$transaction(async (tx) => {
    // 1. Every writer for this cleaner serialises here.
    await lockCleaner(tx, input.cleanerId);

    // 2. Re-read the row under the lock.
    const row = await tx.booking.findUnique({ where: { id: input.bookingId } });
    if (!row) return { ok: false, reason: 'NOT_FOUND' } as const;

    // 3. Compare-and-swap expectations, then the offer window.
    for (const [key, value] of Object.entries(input.expect)) {
      if (value === undefined) continue;
      if (!sameValue((row as Record<string, unknown>)[key], value)) {
        return { ok: false, reason: 'STATE_CHANGED' } as const;
      }
    }
    if (
      input.requireUnexpiredOffer &&
      row.cascadeExpiresAt !== null &&
      row.cascadeExpiresAt.getTime() <= now.getTime()
    ) {
      return { ok: false, reason: 'OFFER_EXPIRED' } as const;
    }

    // 4. Overlap re-read inside the transaction.
    let slotConflict = false;
    if (policy !== 'skip') {
      const slot = input.slot ?? {
        date: row.date,
        startTime: row.startTime,
        durationHours: Number(row.duration),
      };
      const free =
        policy === 'diary'
          ? await slotFreeForCleaner(tx, input.cleanerId, slot, row.id)
          : (await blockingOverlap(tx, input.cleanerId, slot, row.id)) === null;
      const extraOk = input.extraSlotCheck ? await input.extraSlotCheck(tx, row) : true;
      if (!free || !extraOk) {
        if (policy !== 'report') return { ok: false, reason: 'SLOT_TAKEN' } as const;
        slotConflict = true;
      }
    }

    // 5. The claim: a non-cleaner actor (a customer cancel, say) may have
    // changed the row between steps 2 and 5; count 0 says so.
    const expectWhere: Prisma.BookingWhereInput = {};
    for (const [key, value] of Object.entries(input.expect)) {
      if (value !== undefined) (expectWhere as Record<string, unknown>)[key] = value;
    }
    const claim = await tx.booking.updateMany({
      where: {
        id: row.id,
        ...expectWhere,
        AND: [
          ...(input.expectWhere ? [input.expectWhere] : []),
          ...(input.requireUnexpiredOffer
            ? [{ OR: [{ cascadeExpiresAt: null }, { cascadeExpiresAt: { gt: now } }] }]
            : []),
        ],
      },
      data: input.data,
    });
    if (claim.count === 0) return { ok: false, reason: 'STATE_CHANGED' } as const;

    // 6. The re-read row.
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: row.id } });
    if (input.afterClaim) await input.afterClaim(tx, booking);
    return { ok: true, booking, slotConflict } as const;
  }, TX_OPTIONS);
}

/** Cleaner-facing words for a refusal. */
export const ASSIGN_FAILURE_MESSAGE: Record<AssignFailure, string> = {
  NOT_FOUND: 'Booking not found',
  STATE_CHANGED: 'This booking was just taken by another cleaner.',
  OFFER_EXPIRED: 'This offer has expired.',
  SLOT_TAKEN:
    'This job overlaps your schedule — check your availability and bookings for that time.',
};
