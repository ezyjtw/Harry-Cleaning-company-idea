// A2/A3: shared cleaner-eligibility + area search.
//
// The eligibility where-clause was born in /api/cleaners; the location pages
// need the identical definition, so it lives here and BOTH import it — the
// "who is bookable" rule must never fork between search and the area pages.
// Coverage itself still flows through the single predicate
// (isWithinTravelRange in lib/utils/postcode.ts), same as search, matching,
// and the covers endpoint.

import prisma from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { haversineDistance, isWithinTravelRange } from '@/lib/utils/postcode';

/** The base "this cleaner is live and bookable" filter. */
export function eligibleCleanerWhere(now: Date): Record<string, unknown> {
  return {
    verified: true,
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
        r.distance !== null && isWithinTravelRange(r.distance, r.c.maxTravelMinutes, r.c.radius)
    )
    .sort((a, b) => a.distance - b.distance);

  const rates = inArea
    .map((r) => (r.c.hourlyRateRegular ? Number(r.c.hourlyRateRegular) : null))
    .filter((n): n is number => n !== null && n > 0);

  const shown = await Promise.all(
    inArea.slice(0, limit).map(async ({ c, distance }) => ({
      id: c.user.id,
      name: c.user.name || 'Cleaner',
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

/**
 * A3 (sitemap prune): lightweight geometry-only fetch of every eligible
 * cleaner, so the sitemap can apply the ruled 0-cleaner prune across all nine
 * areas with ONE query and no image resolution.
 */
export async function eligibleCleanerGeos(): Promise<
  { latitude: number; longitude: number; maxTravelMinutes: number | null; radius: number }[]
> {
  const now = new Date();
  const rows = await prisma.cleanerProfile.findMany({
    where: eligibleCleanerWhere(now),
    select: { latitude: true, longitude: true, maxTravelMinutes: true, radius: true },
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
    isWithinTravelRange(
      haversineDistance(latitude, longitude, g.latitude, g.longitude),
      g.maxTravelMinutes,
      g.radius
    )
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
    clientName: r.client?.name?.split(/\s+/)[0] || 'Rena customer',
    cleanerName: r.cleaner?.name || 'their cleaner',
  }));
}
