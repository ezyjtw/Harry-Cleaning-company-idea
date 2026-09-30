
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { NextResponse } from 'next/server';

import { SERVICE_AREAS } from '@/lib/areas';
import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { extractPolygon } from '@/lib/services/coverage.service';
import { lookupOutcode } from '@/lib/utils/postcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// R9 HQ — Coverage room data: every live catchment polygon (raw GeoJSON as
// stored), her card data, the served-area centroids, and the gap list (areas
// whose centroid falls inside NO live catchment — the ad-targeting list).
// Centroids come from postcodes.io outcode lookups (Next-cached 24h, counted
// server-side like every other call).
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const profiles = await prisma.cleanerProfile.findMany({
    where: {
      catchmentPolygon: { not: { equals: null } },
      user: { isDeleted: false, accountStatus: 'ACTIVE' },
    },
    select: {
      userId: true,
      rating: true,
      serviceTypes: true,
      maxTravelMinutes: true,
      homePostcode: true,
      postcode: true,
      visibleInDirectory: true,
      verified: true,
      catchmentPolygon: true,
      catchmentGeneratedAt: true,
      user: { select: { name: true } },
    },
  });

  const cleaners = profiles
    .map((p) => ({
      userId: p.userId,
      name: p.user.name ?? 'Unnamed',
      rating: p.rating ? Number(p.rating) : 0,
      serviceTypes: p.serviceTypes,
      maxTravelMinutes: p.maxTravelMinutes,
      homePostcode: p.homePostcode ?? p.postcode ?? null,
      visibleInDirectory: p.visibleInDirectory,
      verified: p.verified,
      generatedAt: p.catchmentGeneratedAt,
      polygon: p.catchmentPolygon, // raw GeoJSON exactly as stored
    }))
    .filter((c) => extractPolygon(c.polygon) !== null);

  const features = cleaners
    .map((c) => extractPolygon(c.polygon))
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const areas = await Promise.all(
    SERVICE_AREAS.map(async (a) => {
      const centroid = await lookupOutcode(a.outcode);
      let covered: boolean | null = null;
      if (centroid) {
        covered = features.some((f) => {
          try {
            return booleanPointInPolygon(point([centroid.longitude, centroid.latitude]), f);
          } catch {
            return false;
          }
        });
      }
      return {
        slug: a.slug,
        name: a.name,
        outcode: a.outcode,
        lat: centroid?.latitude ?? null,
        lng: centroid?.longitude ?? null,
        covered, // null = centroid lookup unavailable (honest unknown, not a gap)
      };
    })
  );

  return NextResponse.json({
    cleaners,
    areas,
    gaps: areas.filter((a) => a.covered === false).map((a) => a.name),
  });
}
