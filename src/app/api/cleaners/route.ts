import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isNewToRena } from '@/lib/constants/badges';
import prisma from '@/lib/db/prisma';
import { eligibleCleanerWhere, expandSlots } from '@/lib/services/area-search.service';
import { blockedUserIds } from '@/lib/services/block.service';
import { cleanerCoversPoint } from '@/lib/services/coverage.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';
import { haversineDistance, lookupPostcode } from '@/lib/utils/postcode';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const availableNow = searchParams.get('available_now');
  const postcode = searchParams.get('postcode');
  const specialty = searchParams.get('specialty');
  const service = searchParams.get('service');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const now = new Date();
  // A2: the base eligibility filter is shared with the location pages
  // (area-search.service) so "who is bookable" can never fork between them.
  const where: Record<string, unknown> = eligibleCleanerWhere(now);

  if (availableNow === 'true') {
    where.availableNow = true;
  }

  if (specialty) {
    where.specialties = { has: specialty };
  }

  if (service) {
    const serviceTypeMap: Record<string, string> = {
      regular: 'regular',
      deep: 'deep',
      same_day: 'same_day',
      'same-day': 'same_day',
      end_of_tenancy: 'end_of_tenancy',
      eot: 'end_of_tenancy',
      airbnb: 'airbnb',
    };
    const mappedService = serviceTypeMap[service] || service;
    where.serviceTypes = { has: mappedService };

    const rateFilter: Record<string, Record<string, unknown>> = {
      regular: { hourlyRateRegular: { not: null } },
      deep: { hourlyRateDeep: { not: null } },
      same_day: { hourlyRateSameDay: { not: null } },
      end_of_tenancy: { eotPrices: { not: null } },
      airbnb: { airbnbPrices: { not: null } },
    };
    if (rateFilter[mappedService]) {
      Object.assign(where, rateFilter[mappedService]);
    }
  }

  let customerGeo: { latitude: number; longitude: number } | null = null;

  if (postcode) {
    // H31: canonicalise the search input too, so the geo-miss prefix fallback
    // behaves identically however the customer typed it.
    const canonical = normalizeUkPostcode(postcode) ?? postcode;
    const geo = await lookupPostcode(canonical);
    if (geo) {
      customerGeo = { latitude: geo.latitude, longitude: geo.longitude };
      where.latitude = { not: null };
      where.longitude = { not: null };
    } else {
      const prefix = canonical.split(' ')[0].toUpperCase();
      where.postcode = { startsWith: prefix };
    }
  }

  // UGC block (James-ruled): a signed-in viewer never sees a cleaner either of
  // them has blocked. Logged-out browse is untouched (no viewer, no block).
  {
    const { getSessionUser } = await import('@/lib/auth/session');
    const viewer = await getSessionUser().catch(() => null);
    const blocked = viewer ? await blockedUserIds(viewer.id) : null;
    if (blocked && blocked.size > 0) {
      where.userId = { notIn: Array.from(blocked) };
    }
  }

  let cleaners = await prisma.cleanerProfile.findMany({
    where,
    // Coverage needs the stored isochrone ONLY when filtering by a customer
    // point; without a postcode (homepage carousel, plain directory) the
    // global omit keeps the heavy polygons out of the query entirely.
    ...(customerGeo ? { omit: { catchmentPolygon: false } } : {}),
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      availabilitySlots: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
  });

  // B: coverage filter runs on the RAW rows (polygon-first predicate; the
  // stored isochrone never enters the JSON response). Sorting by distance
  // still happens after mapping.
  if (customerGeo) {
    const geo = customerGeo;
    cleaners = cleaners.filter((c) => {
      if (c.latitude === null || c.longitude === null) return false;
      const d = haversineDistance(geo.latitude, geo.longitude, c.latitude, c.longitude);
      return cleanerCoversPoint(c, geo.latitude, geo.longitude, d);
    });
  }

  // H23: card review counts come from the SAME population as the blended
  // rating (native VISIBLE + imported VERIFIED) — reviewsReceived.length was
  // native-only AND counted hidden reviews, so imported-only founding
  // cleaners showed a real rating with "(0 reviews)".
  const { getReviewCounts } = await import('@/lib/services/rating.service');
  const reviewCounts = await getReviewCounts(cleaners.map((c) => c.user.id));

  const results = await Promise.all(
    cleaners.map(async (c) => {
      let distance: number | null = null;
      if (customerGeo && c.latitude !== null && c.longitude !== null) {
        distance = haversineDistance(
          customerGeo.latitude,
          customerGeo.longitude,
          c.latitude,
          c.longitude
        );
      }

      const photoUrl = await resolveProfileImageUrl(c.user.image);

      return {
        id: c.user.id,
        name: displayName(c.user.name),
        photo: photoUrl || '',
        image: photoUrl,
        rating: Number(c.rating),
        reviewCount: reviewCounts.get(c.user.id) ?? 0,
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
        radius: c.radius,
        maxTravelMinutes: c.maxTravelMinutes,
        travelMode: c.travelMode,
        // F-B badges: permanent founding flag + computed "New to Rena" expiry
        // (5 completed jobs or 60 days post-go-live, whichever first).
        founding: c.foundingCleaner,
        isNew: isNewToRena(
          c.completedJobs,
          c.liveNotifiedAt ?? c.identityVerifiedAt ?? c.createdAt
        ),
        distance,
        ...expandSlots(c.availabilitySlots),
      };
    })
  );

  if (customerGeo) {
    // Coverage already decided on the raw rows above — just order by distance.
    results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  const total = results.length;
  const paged = results.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    cleaners: paged,
    count: total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}

// Stores an already-validated profile photo (content-verified + size-checked by
// decodeBase64File up-front in the POST handler). Returns the R2 object key.
