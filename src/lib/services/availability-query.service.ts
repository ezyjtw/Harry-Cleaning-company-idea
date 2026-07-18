import {
  computeCleanerOpenRanges,
  expandToSlots,
  timeToMinutes,
  toDateString,
} from '@/lib/availability/timesheet';
import { prisma } from '@/lib/db/prisma';
import { getReviewCounts } from '@/lib/services/rating.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';

import { MatchingService } from './matching.service';

// ─── Time-first DISCOVERY layer ─────────────────────────────────────────────
//
// "Which cleaners are available somewhere within a time-of-day BAND on a date,
// for a service in a postcode?" — the query behind the time-first front door.
//
// Two responsibilities, from two reused sources (no divergence, no new logic):
//   • CANDIDATES + RANKING → MatchingService.findMatches (skipAvailabilityFilter:
//     true, so it returns ALL area + service-qualified cleaners, ranked by the same
//     totalScore the cascade uses — its recurring-only availability gate is skipped).
//   • AVAILABILITY GATE → computeCleanerOpenRanges (lib/availability/timesheet), the
//     SAME helper the per-cleaner calendar uses: real timesheet = recurring weekly
//     + date-specific slots + time-off overrides + existing bookings (± buffer).
//     So a cleaner who blocked the date does NOT appear; a cleaner who added a
//     date-specific slot DOES.
//
// Discovery only — it books nothing. Picking a cleaner here pre-fills the NORMAL
// cleaner-first booking (that cleaner as primary + the slot) and runs the identical
// PENDING→AWAITING_CLEANER→accept→cascade with the normal backups. A time-first
// booking of Cleaner X is identical to a cleaner-first booking of Cleaner X.
//
// Cost: findMatches once (candidates) + one batched timesheet load for the date +
// O(cleaners) range math. Acceptable at current scale; not optimised.

export type TimeBand = 'morning' | 'afternoon' | 'evening';

/** Bands are START windows — the job starts within [startMin, endMin); its end may
 *  extend past the band (the cleaner's own open range must still cover the duration). */
export const TIME_BANDS: Record<TimeBand, { label: string; startMin: number; endMin: number }> = {
  morning: { label: 'Morning', startMin: 8 * 60, endMin: 12 * 60 }, // 08:00–12:00
  afternoon: { label: 'Afternoon', startMin: 12 * 60, endMin: 17 * 60 }, // 12:00–17:00
  evening: { label: 'Evening', startMin: 17 * 60, endMin: 21 * 60 }, // 17:00–21:00
};

export interface BandAvailabilityCriteria {
  date: Date;
  band: TimeBand;
  duration: number; // hours
  serviceType: string;
  postcode: string;
  clientId?: string; // optional — repeat-cleaner prioritisation, forwarded to findMatches
}

/**
 * A ranked available cleaner + the in-band start-times they can take. Carries the
 * display fields the results list AND the booking step need, so the client never
 * has to cross-reference its (capped) local cleaners list — an available cleaner
 * can't silently vanish. `id` is the User id (= Booking.cleanerId = Cleaner.id).
 */
export interface AvailableCleanerCard {
  id: string;
  name: string;
  /** H16: resolved profile photo URL (resolveProfileImageUrl) — null when unset. */
  photo: string | null;
  tier: string; // lowercased, e.g. "gold"
  rating: number;
  reviewCount: number;
  bio: string;
  hourlyRateRegular: number | null;
  hourlyRateDeep: number | null;
  hourlyRateSameDay: number | null;
  eotPrices: Record<string, number> | null;
  airbnbPrices: Record<string, number> | null;
  identityVerified: boolean;
  backgroundChecked: boolean;
  openStartTimes: string[]; // "HH:MM" starts within the band this cleaner is free for
}

export interface BandAvailabilityResult {
  date: string; // YYYY-MM-DD
  band: TimeBand;
  cleaners: AvailableCleanerCard[];
}

export async function getAvailableCleanersForBand(
  criteria: BandAvailabilityCriteria
): Promise<BandAvailabilityResult> {
  const band = TIME_BANDS[criteria.band];
  const durationMins = criteria.duration * 60;
  const dateStr = toDateString(criteria.date);

  // 1. CANDIDATES + RANKING — findMatches with the availability gate OFF.
  const nominalStart = `${String(Math.floor(band.startMin / 60)).padStart(2, '0')}:${String(
    band.startMin % 60
  ).padStart(2, '0')}`;
  const matchResult = await MatchingService.findMatches({
    date: criteria.date,
    startTime: nominalStart,
    duration: criteria.duration,
    serviceType: criteria.serviceType,
    postcode: criteria.postcode,
    clientId: criteria.clientId,
    skipAvailabilityFilter: true,
  });
  const candidates = matchResult.matches;
  if (candidates.length === 0) {
    return { date: dateStr, band: criteria.band, cleaners: [] };
  }

  const profileIds = candidates.map((c) => c.cleanerId);
  const userIds = candidates.map((c) => c.userId);

  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999`);

  // 2. AVAILABILITY GATE inputs — one batched timesheet load for this date.
  const [profiles, dateSlots, overrides, bookings] = await Promise.all([
    prisma.cleanerProfile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        bookingBufferMinutes: true,
        // Display fields — returned so the client renders directly (no cross-ref).
        rating: true,
        tier: true,
        bio: true,
        hourlyRateRegular: true,
        hourlyRateDeep: true,
        hourlyRateSameDay: true,
        eotPrices: true,
        airbnbPrices: true,
        verificationStatus: true,
        backgroundCheckPassed: true,
        availabilitySlots: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        user: { select: { name: true, image: true } },
      },
    }),
    prisma.availabilityDateSlot.findMany({
      where: { cleanerProfileId: { in: profileIds }, date: { gte: startOfDay, lte: endOfDay } },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
    prisma.availabilityOverride.findMany({
      where: {
        cleanerProfileId: { in: profileIds },
        date: { gte: startOfDay, lte: endOfDay },
        isBlocked: true,
      },
      select: { cleanerProfileId: true, date: true, startTime: true, endTime: true },
    }),
    prisma.booking.findMany({
      where: {
        cleanerId: { in: userIds },
        date: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      select: { cleanerId: true, date: true, startTime: true, duration: true },
    }),
  ]);

  // H23: blended review counts (native VISIBLE + imported VERIFIED) — the same
  // population as the stored rating the card shows.
  const reviewCounts = await getReviewCounts(userIds);

  // Group timesheet rows by cleaner (profileId for slots/overrides, userId for bookings).
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const dateSlotsByProfile = groupBy(dateSlots, (d) => d.cleanerProfileId);
  const overridesByProfile = groupBy(overrides, (o) => o.cleanerProfileId);
  const bookingsByUser = groupBy(bookings, (b) => b.cleanerId);

  const isPast = dateStr <= toDateString(new Date());

  // 3. Gate each candidate on the accurate timesheet; keep those open in the band.
  //    Keep the matching score alongside for ranking, then strip it from the output.
  const available: { card: AvailableCleanerCard; score: number }[] = [];
  for (const c of candidates) {
    const profile = profileById.get(c.cleanerId);
    if (!profile) continue;

    const { openRanges } = computeCleanerOpenRanges({
      targetDate: criteria.date,
      bufferMins: profile.bookingBufferMinutes,
      recurringSlots: profile.availabilitySlots,
      dateSlots: dateSlotsByProfile.get(c.cleanerId) ?? [],
      overrides: overridesByProfile.get(c.cleanerId) ?? [],
      bookings: bookingsByUser.get(c.userId) ?? [],
      isPast,
    });

    // Bookable starts that fit the duration AND begin within the band window.
    const openStartTimes = expandToSlots(openRanges, durationMins).filter((t) => {
      const m = timeToMinutes(t);
      return m >= band.startMin && m < band.endMin;
    });

    if (openStartTimes.length === 0) continue;

    available.push({
      score: c.totalScore,
      card: {
        id: c.userId, // Booking.cleanerId / Cleaner.id
        name: profile.user.name ?? c.name,
        // H16: resolved below in one batch (resolver is async).
        photo: profile.user.image,
        tier: profile.tier.toLowerCase(),
        rating: Number(profile.rating),
        reviewCount: reviewCounts.get(c.userId) ?? 0,
        bio: profile.bio ?? '',
        hourlyRateRegular:
          profile.hourlyRateRegular !== null ? Number(profile.hourlyRateRegular) : null,
        hourlyRateDeep: profile.hourlyRateDeep !== null ? Number(profile.hourlyRateDeep) : null,
        hourlyRateSameDay:
          profile.hourlyRateSameDay !== null ? Number(profile.hourlyRateSameDay) : null,
        eotPrices: (profile.eotPrices as Record<string, number> | null) ?? null,
        airbnbPrices: (profile.airbnbPrices as Record<string, number> | null) ?? null,
        identityVerified: profile.verificationStatus === 'VERIFIED',
        backgroundChecked: profile.backgroundCheckPassed,
        openStartTimes,
      },
    });
  }

  // Rank by the existing matching score (desc), then strip the score.
  available.sort((a, b) => b.score - a.score);

  // H16: raw storage keys → servable URLs, exactly like every other surface.
  const cards = await Promise.all(
    available.map(async (x) => ({ ...x.card, photo: await resolveProfileImageUrl(x.card.photo) }))
  );

  return { date: dateStr, band: criteria.band, cleaners: cards };
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
