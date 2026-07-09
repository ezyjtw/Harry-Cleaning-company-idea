import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { cleanerCoversPoint } from '@/lib/services/coverage.service';
import { haversineDistance, isValidPostcode, lookupPostcode } from '@/lib/utils/postcode';

// GET /api/cleaners/[id]/covers?postcode=E4 7AP
//
// Does this cleaner cover the given postcode? Uses the EXACT same coverage logic
// as search (geocode → haversine → isWithinTravelRange), so the booking
// address-step check can never disagree with who search says serves an area.
//
// Fails OPEN: when coverage can't be evaluated (bad/ungeocodable postcode, or a
// cleaner with no geocoded home), it returns covers:true rather than rejecting a
// customer who already selected this cleaner from a coverage-validated search.
// It rejects ONLY when it can positively prove the address is out of range.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const postcode = new URL(request.url).searchParams.get('postcode');

  if (!postcode || !isValidPostcode(postcode)) {
    return NextResponse.json({ covers: true, reason: 'unevaluable' });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: params.id },
    select: {
      latitude: true,
      longitude: true,
      maxTravelMinutes: true,
      radius: true,
      catchmentPolygon: true,
    },
  });

  if (!profile || profile.latitude === null || profile.longitude === null) {
    return NextResponse.json({ covers: true, reason: 'unevaluable' });
  }

  const geo = await lookupPostcode(postcode);
  if (!geo) {
    return NextResponse.json({ covers: true, reason: 'geocode_unavailable' });
  }

  const distanceMiles = haversineDistance(
    geo.latitude,
    geo.longitude,
    profile.latitude,
    profile.longitude
  );
  // B: polygon-first (stored isochrone), crow-flies fallback inside.
  const covers = cleanerCoversPoint(profile, geo.latitude, geo.longitude, distanceMiles);

  return NextResponse.json({ covers });
}
