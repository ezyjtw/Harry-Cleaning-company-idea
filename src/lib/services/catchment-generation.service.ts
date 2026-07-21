// B (travel-time catchment): isochrone generation via OpenRouteService.
//
// James's architecture: postcodes.io (postcode → lat/lng, free, keyless) →
// ORS Isochrone API → raw GeoJSON stored on the cleaner profile → the hot
// path does turf point-in-polygon with ZERO external calls.
//
// Dormant without ORS_API_KEY (like Sentry/Xero). Generation is fire-and-
// forget from its triggers (onboarding completion, homePostcode /
// maxTravelMinutes change) — a provider outage never blocks a profile save;
// the cleaner simply keeps the crow-flies fallback until the next attempt.
//
// Free-tier reality (~500/day, ~20/min): normal operation is a handful of
// calls a day. The batch migration (scripts/generate-catchments.ts) throttles
// itself to ~1 call / 3.5s and stops at 450/day.

import prisma from '@/lib/db/prisma';
import { lookupPostcode } from '@/lib/utils/postcode';

const ORS_ISOCHRONE_URL = 'https://api.openrouteservice.org/v2/isochrones';
// F9: '-tf0.7' stamps traffic-calibrated polygons so they're distinguishable
// from the old free-flow ones at a glance in the DB.
export const CATCHMENT_SOURCE = 'ors-isochrone-v1-tf0.7';
// Drive-only launch (James-ruled). catchmentSource future-proofs a mode swap.
const ORS_PROFILE = 'driving-car';
const DEFAULT_TRAVEL_MINUTES = 30; // James-ruled default
// F9 (James-ruled ×0.7): ORS isochrones are FREE-FLOW driving time — far too
// optimistic for London traffic (a free-flow 30-min polygon from E4 reached
// Harlow). The minutes REQUESTED from ORS are discounted by this factor
// (30 → 21) so the polygon approximates real-traffic reach. Only the ORS
// request is discounted — the cleaner's stored and displayed maxTravelMinutes
// stays their honest number everywhere else.
export const TRAFFIC_FACTOR = 0.7;

export type CatchmentResult =
  | { status: 'generated' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

/**
 * Generate (or refresh) the stored isochrone for one cleaner.
 * Reads homePostcode + maxTravelMinutes, writes catchmentPolygon/-At/-Source.
 */
export async function generateCatchmentForCleaner(userId: string): Promise<CatchmentResult> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return { status: 'skipped', reason: 'ORS_API_KEY not set (feature dormant)' };

  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true, homePostcode: true, postcode: true, maxTravelMinutes: true },
  });
  if (!profile) return { status: 'skipped', reason: 'no cleaner profile' };

  const postcode = profile.homePostcode || profile.postcode;
  if (!postcode) return { status: 'skipped', reason: 'no home postcode on profile' };

  const geo = await lookupPostcode(postcode);
  if (!geo) return { status: 'failed', reason: `postcode lookup failed for ${postcode}` };

  const minutes = profile.maxTravelMinutes ?? DEFAULT_TRAVEL_MINUTES;

  try {
    const res = await fetch(`${ORS_ISOCHRONE_URL}/${ORS_PROFILE}`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations: [[geo.longitude, geo.latitude]],
        // F9: traffic-discounted request (see TRAFFIC_FACTOR above).
        range: [Math.round(minutes * TRAFFIC_FACTOR * 60)], // seconds
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { status: 'failed', reason: `ORS ${res.status}: ${body.slice(0, 200)}` };
    }
    const geojson = await res.json();
    if (
      geojson?.type !== 'FeatureCollection' ||
      !Array.isArray(geojson.features) ||
      geojson.features.length === 0
    ) {
      return { status: 'failed', reason: 'ORS returned no isochrone features' };
    }

    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: {
        catchmentPolygon: geojson,
        catchmentGeneratedAt: new Date(),
        catchmentSource: CATCHMENT_SOURCE,
      },
    });
    return { status: 'generated' };
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : 'network error' };
  }
}

/**
 * Fire-and-forget trigger — call after any save that changes homePostcode or
 * maxTravelMinutes, and on onboarding completion. Never throws, never awaited
 * by the caller's response path.
 */
export function triggerCatchmentRefresh(userId: string): void {
  void generateCatchmentForCleaner(userId)
    .then((r) => {
      if (r.status === 'generated') {
        // H105 rider: mint success is LOUD — H105 was only diagnosable because
        // absence-of-call was silent; this line makes the next absence
        // self-announcing (both-ways logging, matching the heal sweep).
        // eslint-disable-next-line no-console
        console.log(`[catchment] polygon minted for ${userId}`);
      } else if (r.status === 'failed') {
        // eslint-disable-next-line no-console
        console.warn(`[catchment] generation failed for ${userId}: ${r.reason}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[catchment] ${r.status} for ${userId}: ${r.reason}`);
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[catchment] generation crashed for ${userId}:`, err);
    });
}
