// R1-A (amended): the post-completion "make it regular" offer — single source
// of eligibility truth for the completion email, the booking detail pages and
// the guest surface. The offer renders ONLY when:
//   (a) this booking is COMPLETED/REVIEWED (the structural trial clean), and
//   (b) the cleaner has ≥1 recurring-eligible slot open, and
//   (c) the pair doesn't ALREADY have an ACTIVE agreement (never re-offer).
// No open slots → no CTA, ever (no dead-end buttons).

import { prisma } from '@/lib/db/prisma';

export interface RegularOfferSlot {
  dayOfWeek: number;
  start: string;
  end: string;
}

// serviceType values that map to hourly cleans (the wizard's url-slugs and
// their db-slug variants both appear on historical booking rows).
const HOURLY_SERVICES = new Set(['regular', 'deep', 'same-day', 'same_day']);

export interface RegularCleanOffer {
  eligible: boolean;
  reason?: 'not-completed' | 'no-open-slots' | 'already-regular' | 'not-found' | 'not-hourly';
  cleanerId?: string;
  cleanerName?: string;
  slots?: RegularOfferSlot[];
  /** The slot covering the weekday+time the customer just had, if opened. */
  usualSlot?: RegularOfferSlot | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function slotLabel(s: RegularOfferSlot): string {
  return `${DAY_NAMES[s.dayOfWeek]}s ${s.start}–${s.end}`;
}

export async function getRegularCleanOffer(bookingId: string): Promise<RegularCleanOffer> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      date: true,
      startTime: true,
      serviceType: true,
      clientId: true,
      guestEmail: true,
      cleanerId: true,
      cleaner: {
        select: {
          name: true,
          cleanerProfile: {
            select: {
              availabilitySlots: {
                where: { recurringEligible: true },
                select: { dayOfWeek: true, startTime: true, endTime: true },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
              },
            },
          },
        },
      },
    },
  });
  if (!booking) return { eligible: false, reason: 'not-found' };
  const cleanerName = booking.cleaner?.name ?? 'your cleaner';
  if (booking.status !== 'COMPLETED' && booking.status !== 'REVIEWED') {
    return { eligible: false, reason: 'not-completed', cleanerName, cleanerId: booking.cleanerId };
  }
  // Fixed-price recurring (Airbnb/EoT) is PARKED post-launch (James-ruled) —
  // the offer fires only off hourly cleans.
  if (!HOURLY_SERVICES.has(booking.serviceType)) {
    return { eligible: false, reason: 'not-hourly', cleanerName, cleanerId: booking.cleanerId };
  }

  const slots = (booking.cleaner?.cleanerProfile?.availabilitySlots ?? []).map((s) => ({
    dayOfWeek: s.dayOfWeek,
    start: s.startTime,
    end: s.endTime,
  }));
  if (slots.length === 0) {
    return { eligible: false, reason: 'no-open-slots', cleanerName, cleanerId: booking.cleanerId };
  }

  const existing = await prisma.recurringAgreement.findFirst({
    where: {
      cleanerId: booking.cleanerId,
      // F23: an open request counts too — never re-offer while one is pending.
      status: { in: ['ACTIVE', 'PENDING_CLEANER_ACCEPTANCE'] },
      ...(booking.clientId
        ? { clientId: booking.clientId }
        : { guestEmail: { equals: booking.guestEmail ?? '', mode: 'insensitive' } }),
    },
    select: { id: true },
  });
  if (existing) {
    return {
      eligible: false,
      reason: 'already-regular',
      cleanerName,
      cleanerId: booking.cleanerId,
    };
  }

  const dow = booking.date.getUTCDay();
  const usualSlot =
    slots.find(
      (s) => s.dayOfWeek === dow && s.start <= booking.startTime && s.end > booking.startTime
    ) ?? null;

  return {
    eligible: true,
    cleanerId: booking.cleanerId,
    cleanerName,
    slots,
    usualSlot,
  };
}
