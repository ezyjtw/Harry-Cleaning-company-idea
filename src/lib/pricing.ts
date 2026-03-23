// Pricing model:
//   1. Platform markup (10%) — baked into the listed rate the client sees.
//      The cleaner sets £15/hr → client sees £16.50/hr. The cleaner knows
//      about this; the client does NOT see it as a separate line item.
//   2. Service fee (5%) — calculated on the final total (inclusive).
//      total = listedRate / 0.95, serviceFee = total × 5%.

export const PLATFORM_COMMISSION_PERCENT = 10;
export const SERVICE_FEE_PERCENT = 5;

/**
 * From a cleaner's own rate, get the listed rate the client sees
 * (cleaner rate + 10% markup, presented as a single figure).
 */
export function getListedRate(cleanerRate: number): number {
  return Math.round(cleanerRate * (1 + PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
}

/** Alias kept for backward compat — same as getListedRate. */
export const getSubtotal = getListedRate;

/**
 * Calculate the 5% service fee on the total (inclusive).
 * Given a listed amount, total = listed / 0.95, fee = total * 0.05.
 */
export function getServiceFee(listedAmount: number): number {
  const total = listedAmount / (1 - SERVICE_FEE_PERCENT / 100);
  return Math.round((total - listedAmount) * 100) / 100;
}

/**
 * Convert a cleaner's rate to the total the client pays
 * (listed rate + 5% service fee on total).
 */
export function getDisplayedRate(cleanerNetRate: number): number {
  const listed = getListedRate(cleanerNetRate);
  return Math.round((listed / (1 - SERVICE_FEE_PERCENT / 100)) * 100) / 100;
}

/**
 * From a displayed (client-facing) total, extract the cleaner earnings.
 */
export function getCleanerEarnings(displayedTotal: number): number {
  // total = listedRate / 0.95, listedRate = cleanerRate * 1.10
  // so total = cleanerRate * 1.10 / 0.95
  const factor = (1 + PLATFORM_COMMISSION_PERCENT / 100) / (1 - SERVICE_FEE_PERCENT / 100);
  return Math.round((displayedTotal / factor) * 100) / 100;
}

/**
 * From a displayed total, extract the platform commission (10% of cleaner rate).
 */
export function getPlatformFee(displayedTotal: number): number {
  const cleanerEarnings = getCleanerEarnings(displayedTotal);
  return Math.round(cleanerEarnings * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
}

/**
 * From a displayed total, extract the service fee (5% of total).
 */
export function getCustomerServiceFee(displayedTotal: number): number {
  return Math.round(displayedTotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Full price breakdown.
 *
 * Client view: they see `listedRate` (which already includes the 10% markup)
 * + `serviceFee` (5% of total) = `total`. They never see `cleanerEarnings` or `platformCommission`.
 *
 * Cleaner/admin view: also includes `cleanerEarnings` and `platformCommission`.
 */
export function getPriceBreakdown(
  cleanerRate: number,
  duration: number,
  serviceMultiplier: number
) {
  const cleanerEarnings = Math.round(cleanerRate * duration * serviceMultiplier * 100) / 100;
  const platformCommission =
    Math.round(cleanerEarnings * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
  // listedSubtotal is what the client sees as "the rate" (markup already baked in)
  const listedSubtotal = cleanerEarnings + platformCommission;
  // Service fee is 5% of the final total (inclusive): total = listed / 0.95
  const total = Math.round((listedSubtotal / (1 - SERVICE_FEE_PERCENT / 100)) * 100) / 100;
  const serviceFee = Math.round((total - listedSubtotal) * 100) / 100;

  return {
    cleanerRate,
    duration,
    serviceMultiplier,
    // Cleaner/admin only
    cleanerEarnings,
    platformCommission,
    platformCommissionPercent: PLATFORM_COMMISSION_PERCENT,
    // Client-visible
    listedSubtotal,
    /** @deprecated use listedSubtotal */
    subtotal: listedSubtotal,
    serviceFee,
    serviceFeePercent: SERVICE_FEE_PERCENT,
    total,
  };
}
