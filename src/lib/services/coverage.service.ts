// B (travel-time catchment): THE coverage predicate, polygon-first.
//
// Server-only module (turf import) — client code never decides coverage.
// Decision order per cleaner:
//   1. stored isochrone polygon → turf booleanPointInPolygon (zero external
//      calls — the hot path never talks to a provider)
//   2. no polygon yet → the crow-flies travel-time logic that has always run
//      (isWithinTravelRange: haversine miles @ 25 mph vs maxTravelMinutes,
//      radius as last resort)
// A malformed stored polygon falls through to (2) rather than throwing —
// coverage must never 500 a search or a booking.

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

import { isWithinTravelRange } from '@/lib/utils/postcode';

export interface CoverageProfile {
  catchmentPolygon?: unknown;
  maxTravelMinutes: number | null;
  radius: number | null;
}

type GeoJsonPolygonish = {
  type: string;
  features?: { geometry?: { type?: string } }[];
  geometry?: { type?: string };
  coordinates?: unknown;
};

/** Extract the first Polygon/MultiPolygon feature from stored GeoJSON. */
function extractPolygon(raw: unknown): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as GeoJsonPolygonish;
  try {
    if (g.type === 'FeatureCollection' && Array.isArray(g.features)) {
      const f = g.features.find(
        (feat) => feat?.geometry?.type === 'Polygon' || feat?.geometry?.type === 'MultiPolygon'
      );
      return (f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) ?? null;
    }
    if (g.type === 'Feature' && (g.geometry?.type === 'Polygon' || g.geometry?.type === 'MultiPolygon')) {
      return g as unknown as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    }
    if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates) {
      return {
        type: 'Feature',
        properties: {},
        geometry: g as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Does this cleaner cover the customer point?
 * `distanceMiles` is the already-computed haversine distance (every caller
 * computes it anyway for sorting) — used only by the fallback.
 */
export function cleanerCoversPoint(
  cleaner: CoverageProfile,
  customerLat: number,
  customerLng: number,
  distanceMiles: number
): boolean {
  const polygon = extractPolygon(cleaner.catchmentPolygon);
  if (polygon) {
    try {
      // GeoJSON is [lng, lat]
      return booleanPointInPolygon(point([customerLng, customerLat]), polygon);
    } catch {
      // malformed geometry → crow-flies fallback below
    }
  }
  return isWithinTravelRange(distanceMiles, cleaner.maxTravelMinutes, cleaner.radius);
}
