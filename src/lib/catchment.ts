/**
 * Service area / catchment configuration.
 *
 * Add postcode prefixes here as you expand to new areas.
 * Prefixes are matched against the leading letters of a UK postcode
 * (e.g. "E" matches E1, E4, E10, E17 etc.).
 */
export const COVERED_POSTCODE_PREFIXES = ['E', 'IG'];

/**
 * Extract the letter prefix from a UK postcode (e.g. "E17 4QR" → "E", "SW1A 1AA" → "SW").
 */
export function getPostcodePrefix(postcode: string): string {
  const match = postcode
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2})/);
  return match ? match[1] : '';
}

/**
 * Check whether a postcode falls within the current service area.
 */
export function isInCatchmentArea(postcode: string): boolean {
  const prefix = getPostcodePrefix(postcode);
  if (!prefix) return false;
  return COVERED_POSTCODE_PREFIXES.includes(prefix);
}
