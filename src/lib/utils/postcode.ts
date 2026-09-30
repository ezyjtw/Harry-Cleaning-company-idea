/**
 * UK Postcode utilities — uses postcodes.io (free, no API key needed)
 */

import { logApiCall } from '@/lib/api-metering';

// R9 (HQ API room): count server-side postcodes.io calls. These functions also
// run in the browser (booking form / autocomplete) where logApiCall is a no-op
// by construction — those browser-direct calls are the API room's honest
// "uncounted alongside" note. Fail-silent by law; never affects a lookup.
function countPostcodes(endpoint: string, ok: boolean, httpStatus: number | undefined, t0: number) {
  logApiCall('postcodes', endpoint, {
    status: ok ? 'ok' : 'error',
    httpStatus,
    durationMs: Date.now() - t0,
  });
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const PARTIAL_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

export interface PostcodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
  region: string;
  admin_district: string;
}

/**
 * Validate a UK postcode format (full or partial like "NW4").
 */
export function isValidPostcode(postcode: string): boolean {
  const cleaned = postcode.trim();
  return UK_POSTCODE_REGEX.test(cleaned) || PARTIAL_POSTCODE_REGEX.test(cleaned);
}

// F6: save-time verification needs to tell "that postcode doesn't exist"
// (reject the save) apart from "postcodes.io is down" (fail open, flag for
// lazy retry). lookupPostcode keeps its null-on-anything contract for the
// existing read paths.
export type PostcodeLookupOutcome =
  | { status: 'found'; result: PostcodeResult }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export async function lookupPostcodeOutcome(postcode: string): Promise<PostcodeLookupOutcome> {
  if (!isValidPostcode(postcode)) return { status: 'not_found' };

  const cleaned = encodeURIComponent(postcode.trim().replace(/\s+/g, ''));
  const t0 = Date.now();
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`, {
      next: { revalidate: 86400 },
    });
    countPostcodes('GET /postcodes/{postcode}', res.ok || res.status === 404, res.status, t0);
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'unavailable' };

    const data = await res.json();
    if (data.status === 404) return { status: 'not_found' };
    if (data.status !== 200 || !data.result) return { status: 'unavailable' };

    return {
      status: 'found',
      result: {
        postcode: data.result.postcode,
        latitude: data.result.latitude,
        longitude: data.result.longitude,
        region: data.result.region || '',
        admin_district: data.result.admin_district || '',
      },
    };
  } catch {
    countPostcodes('GET /postcodes/{postcode}', false, undefined, t0);
    return { status: 'unavailable' };
  }
}

/**
 * Look up a full UK postcode via postcodes.io.
 * Returns lat/lng or null if invalid.
 */
export async function lookupPostcode(postcode: string): Promise<PostcodeResult | null> {
  if (!isValidPostcode(postcode)) return null;

  const cleaned = encodeURIComponent(postcode.trim().replace(/\s+/g, ''));
  const t0 = Date.now();

  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`, {
      next: { revalidate: 86400 }, // cache for 24h
    });
    countPostcodes('GET /postcodes/{postcode}', res.ok, res.status, t0);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 200 || !data.result) return null;

    return {
      postcode: data.result.postcode,
      latitude: data.result.latitude,
      longitude: data.result.longitude,
      region: data.result.region || '',
      admin_district: data.result.admin_district || '',
    };
  } catch {
    return null;
  }
}

/**
 * A2: look up an OUTWARD code centroid (e.g. "E4", "IG10") via postcodes.io.
 * Used by the location pages to anchor an area without inventing a street
 * address. Same fail-soft contract as lookupPostcode: null on any failure.
 */
export async function lookupOutcode(
  outcode: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!PARTIAL_POSTCODE_REGEX.test(outcode.trim())) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode.trim().toUpperCase())}`,
      { next: { revalidate: 86400 } }
    );
    countPostcodes('GET /outcodes/{outcode}', res.ok, res.status, t0);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 200 || !data.result?.latitude) return null;
    return { latitude: data.result.latitude, longitude: data.result.longitude };
  } catch {
    return null;
  }
}

/**
 * Autocomplete partial postcode.
 */
export async function autocompletePostcode(partial: string): Promise<string[]> {
  if (partial.length < 2) return [];

  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(partial)}/autocomplete`
    );
    countPostcodes('GET /postcodes/{partial}/autocomplete', res.ok, res.status, t0);
    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

/**
 * Calculate the Haversine distance between two lat/lng points in miles.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * The single coverage predicate: does a cleaner serve a customer `distanceMiles`
 * away? Travel-time first (25 mph average → minutes), radius as fallback. EVERY
 * discovery path (search, matching, the booking address-step check) must call
 * this so search-eligibility and address validation can never disagree.
 */
export function isWithinTravelRange(
  distanceMiles: number,
  maxTravelMinutes: number | null | undefined,
  radiusMiles: number | null | undefined
): boolean {
  if (maxTravelMinutes !== null && maxTravelMinutes !== undefined) {
    return (distanceMiles / 25) * 60 <= maxTravelMinutes;
  }
  return distanceMiles <= (radiusMiles ?? 10);
}
