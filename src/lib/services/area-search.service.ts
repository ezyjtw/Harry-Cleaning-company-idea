// A2/A3: shared cleaner-eligibility + area search.
//
// The eligibility where-clause was born in /api/cleaners; the location pages
// need the identical definition, so it lives here and BOTH import it — the
// "who is bookable" rule must never fork between search and the area pages.
// Coverage itself still flows through the single predicate
// (isWithinTravelRange in lib/utils/postcode.ts), same as search, matching,
// and the covers endpoint.

import prisma from '@/lib/db/prisma';
import { cleanerCoversPoint } from '@/lib/services/coverage.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';
import { haversineDistance } from '@/lib/utils/postcode';

/**
 * The base "this cleaner is LIVE and bookable" filter — the go-live gate
 * (James-ruled two-stage flow): identity verified AND insurance approved
 * (and unexpired) AND Stripe payout onboarding complete. Shared by search,
 * the directory, area pages, the sitemap prune, and matching — who can
 * receive work is decided in exactly one place.
 */
export function eligibleCleanerWhere(now: Date): Record<string, unknown> {
  return {
    verified: true,
    insuranceVerified: true,
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    user: { accountStatus: 'ACTIVE', isDeleted: false },
    OR: [{ insuranceExpiresAt: null }, { insuranceExpiresAt: { gt: now } }],
    // Coverage gate: a cleaner with no geocoded location or no travel radius
    // can't be matched to any customer, so exclude them everywhere.
    latitude: { not: null },
    longitude: { not: null },
    maxTravelMinutes: { not: null },
  };
}

export interface AreaCleanerCard {
  id: string;
  name: string;
  photo: string | null;
  rating: number;
  reviewCount: number;
  location: string;
  fromPrice: number | null;
  distance: number;
}

export interface AreaSearchResult {
  total: number;
  cleaners: AreaCleanerCard[];
  /** min–max of hourlyRateRegular across ALL in-area cleaners (not just shown) */
  rateRange: { min: number; max: number } | null;
}

/**
 * Every eligible cleaner whose travel range covers the given point — the same
 * decision search makes, via the same predicate.
 */
export async function findCleanersNearPoint(
  latitude: number,
  longitude: number,
  limit = 6
): Promise<AreaSearchResult> {
  const now = new Date();
  const rows = await prisma.cleanerProfile.findMany({
    where: eligibleCleanerWhere(now),
    // Area pages are a coverage consumer — re-enable the globally-omitted
    // isochrone for cleanerCoversPoint.
    omit: { catchmentPolygon: false },
    include: {
      user: {
        select: { id: true, name: true, image: true, reviewsReceived: { select: { id: true } } },
      },
    },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
  });

  const inArea = rows
    .map((c) => ({
      c,
      distance:
        c.latitude !== null && c.longitude !== null
          ? haversineDistance(latitude, longitude, c.latitude, c.longitude)
          : null,
    }))
    .filter(
      (r): r is { c: (typeof rows)[number]; distance: number } =>
        r.distance !== null && cleanerCoversPoint(r.c, latitude, longitude, r.distance)
    )
    .sort((a, b) => a.distance - b.distance);

  const rates = inArea
    .map((r) => (r.c.hourlyRateRegular ? Number(r.c.hourlyRateRegular) : null))
    .filter((n): n is number => n !== null && n > 0);

  const shown = await Promise.all(
    inArea.slice(0, limit).map(async ({ c, distance }) => ({
      id: c.user.id,
      name: displayName(c.user.name) || 'Cleaner',
      photo: (await resolveProfileImageUrl(c.user.image)) || null,
      rating: Number(c.rating),
      reviewCount: c.user.reviewsReceived.length,
      location: c.location || '',
      fromPrice: c.hourlyRateRegular
        ? Number(c.hourlyRateRegular)
        : c.hourlyRateDeep
          ? Number(c.hourlyRateDeep)
          : null,
      distance,
    }))
  );

  return {
    total: inArea.length,
    cleaners: shown,
    rateRange: rates.length > 0 ? { min: Math.min(...rates), max: Math.max(...rates) } : null,
  };
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Expand weekly availability rows into the UI's day/half-hour-slot shape. */
export function expandSlots(slots: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  const timeSlots: Record<string, string[]> = {};
  for (const slot of slots) {
    const day = DAY_ABBR[slot.dayOfWeek];
    if (!timeSlots[day]) timeSlots[day] = [];
    const [startH, startM] = slot.startTime.split(':').map(Number);
    const [endH, endM] = slot.endTime.split(':').map(Number);
    let mins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    while (mins < endMins) {
      const h24 = Math.floor(mins / 60);
      const m = mins % 60;
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 || 12;
      timeSlots[day].push(`${h12}:${m.toString().padStart(2, '0')} ${period}`);
      mins += 30;
    }
  }
  for (const day of Object.keys(timeSlots)) {
    timeSlots[day] = Array.from(new Set(timeSlots[day])).sort((a, b) => {
      const toMin = (t: string) => {
        const [time, period] = t.split(' ');
        const [h, mn] = time.split(':').map(Number);
        return ((h % 12) + (period === 'PM' ? 12 : 0)) * 60 + mn;
      };
      return toMin(a) - toMin(b);
    });
  }
  return { availability: Object.keys(timeSlots), timeSlots };
}

/**
 * AI-crawler visibility: the unfiltered first page of the /cleaners directory,
 * server-rendered so the list exists in the HTML (the client page previously
 * fetched everything via JS — empty to non-JS crawlers). Returns the SAME card
 * shape as /api/cleaners' no-postcode response so the client mapping is shared.
 */
export async function listDirectoryCleaners(limit = 50) {
  const now = new Date();
  const rows = await prisma.cleanerProfile.findMany({
    where: eligibleCleanerWhere(now),
    include: {
      user: {
        select: { id: true, name: true, image: true, reviewsReceived: { select: { id: true } } },
      },
      availabilitySlots: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
    take: limit,
  });

  return Promise.all(
    rows.map(async (c) => {
      const photoUrl = await resolveProfileImageUrl(c.user.image);
      return {
        id: c.user.id,
        name: displayName(c.user.name),
        photo: photoUrl || '',
        image: photoUrl,
        rating: Number(c.rating),
        reviewCount: c.user.reviewsReceived.length,
        completedJobs: c.completedJobs,
        yearsExperience: c.yearsExperience ?? 0,
        languages: c.languages || [],
        hourlyRateRegular: c.hourlyRateRegular ? Number(c.hourlyRateRegular) : null,
        hourlyRateDeep: c.hourlyRateDeep ? Number(c.hourlyRateDeep) : null,
        hourlyRateSameDay: c.hourlyRateSameDay ? Number(c.hourlyRateSameDay) : null,
        eotPrices: c.eotPrices || null,
        airbnbPrices: c.airbnbPrices || null,
        serviceTypes: c.serviceTypes || [],
        bio: c.bio,
        specialties: c.specialties,
        location: c.location || '',
        postcode: c.postcode,
        availableNow: c.availableNow,
        tier: c.tier.toLowerCase(),
        verified: c.verified,
        identityVerified: c.verificationStatus === 'VERIFIED',
        insured: c.insuranceVerified && (!c.insuranceExpiresAt || c.insuranceExpiresAt > now),
        backgroundChecked: c.backgroundCheckPassed,
        responseTime: c.responseTime ? `~${c.responseTime} min` : '~15 min',
        distance: null as number | null,
        ...expandSlots(c.availabilitySlots),
      };
    })
  );
}

/**
 * A3 (sitemap prune): lightweight geometry-only fetch of every eligible
 * cleaner, so the sitemap can apply the ruled 0-cleaner prune across all nine
 * areas with ONE query and no image resolution.
 */
export async function eligibleCleanerGeos(): Promise<
  {
    latitude: number;
    longitude: number;
    maxTravelMinutes: number | null;
    radius: number;
    catchmentPolygon: unknown;
  }[]
> {
  const now = new Date();
  const rows = await prisma.cleanerProfile.findMany({
    where: eligibleCleanerWhere(now),
    select: {
      latitude: true,
      longitude: true,
      maxTravelMinutes: true,
      radius: true,
      catchmentPolygon: true,
    },
  });
  return rows.filter(
    (r): r is (typeof rows)[number] & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null
  );
}

/** Same coverage decision as search, applied to a pre-fetched geo list. */
export function countCoveringPoint(
  geos: Awaited<ReturnType<typeof eligibleCleanerGeos>>,
  latitude: number,
  longitude: number
): number {
  return geos.filter((g) =>
    cleanerCoversPoint(g, latitude, longitude, haversineDistance(latitude, longitude, g.latitude, g.longitude))
  ).length;
}

/**
 * Real reviews (native VISIBLE, with text) left for a set of cleaners — the
 * area pages show these only when they exist; no padding, no testimonials.
 */
export async function findReviewsForCleaners(cleanerIds: string[], limit = 3) {
  if (cleanerIds.length === 0) return [];
  const reviews = await prisma.review.findMany({
    where: { cleanerId: { in: cleanerIds }, visibility: 'VISIBLE', text: { not: null } },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      rating: true,
      text: true,
      client: { select: { name: true } },
      cleaner: { select: { name: true } },
    },
  });
  return reviews.map((r) => ({
    id: r.id,
    rating: Math.round(Number(r.rating)),
    text: r.text as string,
    clientName: displayName(r.client?.name?.split(/\s+/)[0]) || 'Rena customer',
    cleanerName: displayName(r.cleaner?.name) || 'their cleaner',
  }));
}
