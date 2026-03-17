// Platform fee configuration
// The fee is built into the displayed rate — customers see a single price.
// Cleaners set their net rate, Rena multiplies by the margin factor.

/** @server-only — do not import in client components */
export const PLATFORM_FEE_PERCENT = 15;

const MARGIN_FACTOR = 1 + PLATFORM_FEE_PERCENT / 100; // 1.15

/**
 * Convert a cleaner's net rate to the rate displayed to customers.
 * Customer never sees a fee breakdown — the displayed rate IS the price.
 */
export function getDisplayedRate(cleanerNetRate: number): number {
  return Math.round(cleanerNetRate * MARGIN_FACTOR * 100) / 100;
}

/**
 * From a displayed (customer-facing) total, extract the cleaner earnings.
 */
export function getCleanerEarnings(displayedTotal: number): number {
  return Math.round((displayedTotal / MARGIN_FACTOR) * 100) / 100;
}

/**
 * From a displayed total, extract the platform fee.
 */
export function getPlatformFee(displayedTotal: number): number {
  return Math.round((displayedTotal - getCleanerEarnings(displayedTotal)) * 100) / 100;
}

/**
 * Get price breakdown for internal/admin use.
 * The customer only ever sees rate × hours = total.
 */
export function getPriceBreakdown(
  displayedRate: number,
  duration: number,
  serviceMultiplier: number
) {
  const displayedTotal = Math.round(displayedRate * duration * serviceMultiplier * 100) / 100;
  const cleanerEarnings = getCleanerEarnings(displayedTotal);
  const platformFee = Math.round((displayedTotal - cleanerEarnings) * 100) / 100;

  return {
    displayedRate,
    duration,
    serviceMultiplier,
    cleanerEarnings,
    platformFee,
    total: displayedTotal,
    platformFeePercent: PLATFORM_FEE_PERCENT,
  };
}
