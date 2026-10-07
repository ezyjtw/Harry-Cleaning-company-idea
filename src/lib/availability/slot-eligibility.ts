// ─── H7: THE shared slot-eligibility predicate ───────────────────────────────
//
// "Would this cleaner appear in an availability-filtered search for this exact
// slot?" — answered from the SAME timesheet core search uses
// (computeCleanerOpenRanges: date-specific slots ELSE recurring template, minus
// time-off overrides, minus existing bookings ± the cleaner's buffer). One
// predicate for booking-time backup attachment, every cascade advance, reserve
// promotion, rescue/Rena-Find broadcasts, rebooking, and accept-time
// re-validation — so the offer machinery can never again promise a cleaner the
// search would refuse.
//
// One deliberate divergence from search: search treats the WHOLE of today as
// past (same-day booking is "coming soon"), but the offer machinery must keep
// working on the day itself (a backup advance hours before the slot must not
// instantly exhaust). Here a slot is "past" only once its START time has
// passed.

import type { BookingStatus, CascadePhase } from '@prisma/client';

import { computeCleanerOpenRanges, timeToMinutes } from '@/lib/availability/timesheet';
import { prisma } from '@/lib/db/prisma';
import { bookingStartUtc, isFlexibleStart, londonDayEndUtc } from '@/lib/time/booking-time';

// ─── H63 (Harry-ruled, availability economics): WHICH bookings block a
// cleaner's slot ───────────────────────────────────────────────────────────
//
// Only COMMITMENT blocks. The old clause (`status notIn ['CANCELLED']`)
// blocked the pinned cleanerId for the booking's whole life — including
// phases where that cleaner had DECLINED (cleanerId stays pinned to the
// primary through the cascade), unpaid PENDING bookings (H53: not real),
// CLEANER_CANCELLED (the canceller walked away) and CASCADE_EXHAUSTED
// (terminal, refunded). The ruling:
//   (a) accepted/assigned work blocks — CONFIRMED/ACCEPTED/EN_ROUTE/
//       IN_PROGRESS (and the done states, for same-day buffer correctness);
//   (b) a PRIMARY offer in its live window blocks (the customer was promised
//       this cleaner is being asked);
//   (c) unaccepted backup/reserve/broadcast membership NEVER blocks — those
//       are maybes, and the H7 offer-time/accept-time re-validation already
//       handles the race if a maybe books out elsewhere.
// Compose with AND to avoid OR-collisions in caller where-objects.
export function blocksCleanerSlotWhere(): {
  OR: (
    | { status: { in: BookingStatus[] } }
    | { status: BookingStatus; cascadePhase: CascadePhase }
  )[];
} {
  return {
    OR: [
      {
        status: {
          in: [
            'CONFIRMED',
            'ACCEPTED',
            'EN_ROUTE',
            'IN_PROGRESS',
            'COMPLETED',
            'REVIEWED',
            'DISPUTED',
            // R1-A: a scheduled occurrence of a recurring agreement IS the
            // commitment — blocking the slot for the regular client is the
            // entire point of the agreement.
            'SCHEDULED',
          ],
        },
      },
      { status: 'AWAITING_CLEANER', cascadePhase: 'PRIMARY_OFFER' },
    ],
  };
}

export interface SlotQuery {
  /** Booking date (the calendar day of the slot). */
  date: Date;
  /** "HH:mm" start time. */
  startTime: string;
  durationHours: number;
  /**
   * Booking row to ignore when collecting conflicts — pass the booking being
   * offered/accepted so it never conflicts with itself (its cleanerId may
   * already point at the cleaner under test, e.g. a primary accepting).
   */
  excludeBookingId?: string;
}

/**
 * Batch form: of these cleaner USER ids, which are genuinely free for the slot?
 * Empty input → empty set. A slot whose start has passed → empty set.
 */
/** A Prisma client or an interactive transaction (B3: the assignment helper
 *  re-reads availability inside its locked transaction). */
export type SlotDb = Pick<
  typeof prisma,
  'cleanerProfile' | 'availabilityDateSlot' | 'availabilityOverride' | 'booking'
>;

export async function filterSlotAvailableCleaners(
  cleanerUserIds: string[],
  slot: SlotQuery,
  db: SlotDb = prisma
): Promise<Set<string>> {
  const ids = Array.from(new Set(cleanerUserIds));
  if (ids.length === 0) return new Set();

  // H18-REOPENED: 'Flexible'-time bookings exist by design (services flow).
  // timeToMinutes('Flexible') is NaN, and NaN containment excluded EVERY
  // cleaner — a decline on a Flexible booking pruned genuinely-free backups
  // and exhausted+refunded on the spot. For a flexible slot the honest
  // question is "does ANY open range that day fit the duration"; pastness is
  // end-of-day, not a (nonexistent) start time.
  const isFlexible = isFlexibleStart(slot.startTime);

  // The stored booking day is a UTC-midnight date: the row query spans it.
  const startOfDay = new Date(slot.date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(slot.date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // B3 sweep: pastness is read on the London clock (the start, or the end of
  // the London day for a Flexible slot) through the one helper.
  if (isFlexible) {
    if (londonDayEndUtc(slot.date).getTime() <= Date.now()) return new Set();
  } else if ((bookingStartUtc(slot.date, slot.startTime)?.getTime() ?? 0) <= Date.now()) {
    return new Set();
  }

  const startMin = isFlexible ? null : timeToMinutes(slot.startTime);
  const endMin = startMin === null ? null : startMin + slot.durationHours * 60;
  const durationMins = slot.durationHours * 60;

  const profiles = await db.cleanerProfile.findMany({
    // B3 (James-ruled): a cleaner who has deleted their account is skipped by
    // every offer, promotion and accept (backup, reserve and unaccepted offer
    // membership never block a deletion).
    where: {
      userId: { in: ids },
      user: { accountStatus: { not: 'DEACTIVATED' }, isDeleted: false },
    },
    select: {
      id: true,
      userId: true,
      bookingBufferMinutes: true,
      availabilitySlots: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });
  if (profiles.length === 0) return new Set();
  const profileIds = profiles.map((p) => p.id);
  const userIds = profiles.map((p) => p.userId);

  const [dateSlots, overrides, bookings] = await Promise.all([
    db.availabilityDateSlot.findMany({
      where: { cleanerProfileId: { in: profileIds }, date: { gte: startOfDay, lte: endOfDay } },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
    db.availabilityOverride.findMany({
      where: {
        cleanerProfileId: { in: profileIds },
        date: { gte: startOfDay, lte: endOfDay },
        isBlocked: true,
      },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
    // Same conflict source as search: bookings that actually BLOCK (H63).
    db.booking.findMany({
      where: {
        cleanerId: { in: userIds },
        date: { gte: startOfDay, lte: endOfDay },
        AND: [blocksCleanerSlotWhere()],
        ...(slot.excludeBookingId ? { id: { not: slot.excludeBookingId } } : {}),
      },
      select: { cleanerId: true, date: true, startTime: true, duration: true },
    }),
  ]);

  const dateSlotsByProfile = groupBy(dateSlots, (d) => d.cleanerProfileId);
  const overridesByProfile = groupBy(overrides, (o) => o.cleanerProfileId);
  const bookingsByUser = groupBy(bookings, (b) => b.cleanerId);

  const available = new Set<string>();
  for (const p of profiles) {
    const { openRanges } = computeCleanerOpenRanges({
      targetDate: slot.date,
      bufferMins: p.bookingBufferMinutes,
      recurringSlots: p.availabilitySlots,
      dateSlots: dateSlotsByProfile.get(p.id) ?? [],
      overrides: overridesByProfile.get(p.id) ?? [],
      bookings: bookingsByUser.get(p.userId) ?? [],
      isPast: false, // slot-start pastness handled above (offer machinery works same-day)
    });
    const fits =
      startMin === null || endMin === null
        ? openRanges.some((r) => r.end - r.start >= durationMins)
        : openRanges.some((r) => startMin >= r.start && endMin <= r.end);
    if (fits) {
      available.add(p.userId);
    }
  }
  return available;
}

/** Single-cleaner form (accept-time guard, rebooking validation). */
export async function cleanerAvailableForSlot(
  cleanerUserId: string,
  slot: SlotQuery,
  db: SlotDb = prisma
): Promise<boolean> {
  const set = await filterSlotAvailableCleaners([cleanerUserId], slot, db);
  return set.has(cleanerUserId);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
