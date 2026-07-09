/**
 * UK Postcode utilities — uses postcodes.io (free, no API key needed)
 */

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

/**
 * Look up a full UK postcode via postcodes.io.
 * Returns lat/lng or null if invalid.
 */
export async function lookupPostcode(postcode: string): Promise<PostcodeResult | null> {
  if (!isValidPostcode(postcode)) return null;

  const cleaned = encodeURIComponent(postcode.trim().replace(/\s+/g, ''));

  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`, {
      next: { revalidate: 86400 }, // cache for 24h
    });

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
  try {
    const res = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode.trim().toUpperCase())}`,
      { next: { revalidate: 86400 } }
    );
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

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(partial)}/autocomplete`
    );
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
