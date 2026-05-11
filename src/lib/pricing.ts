// Pricing model:
//   1. Platform commission (10%) — taken from the cleaner's set rate.
//      The cleaner sets £15/hr → client sees £15/hr. Cleaner receives
//      £13.50, Rena keeps £1.50. The client does NOT see commission.
//   2. Service fee (6%) — calculated on the final total (inclusive).
//      total = listedRate / 0.94, serviceFee = total × 6%.

export const PLATFORM_COMMISSION_PERCENT = 10;
export const SERVICE_FEE_PERCENT = 6;

/**
 * From a cleaner's own rate, get the listed rate the client sees.
 * The rate the cleaner sets IS the rate the customer sees.
 */
export function getListedRate(cleanerRate: number): number {
  return Math.round(cleanerRate * 100) / 100;
}

/** Alias kept for backward compat — same as getListedRate. */
export const getSubtotal = getListedRate;

/**
 * Calculate the 6% service fee on the total (inclusive).
 * Given a listed amount, total = listed / 0.94, fee = total - listed.
 */
export function getServiceFee(listedAmount: number): number {
  const total = listedAmount / (1 - SERVICE_FEE_PERCENT / 100);
  return Math.round((total - listedAmount) * 100) / 100;
}

/**
 * Convert a cleaner's rate to the total the client pays
 * (listed rate + 6% service fee on total).
 */
export function getDisplayedRate(cleanerNetRate: number): number {
  const listed = getListedRate(cleanerNetRate);
  return Math.round((listed / (1 - SERVICE_FEE_PERCENT / 100)) * 100) / 100;
}

/**
 * From a displayed (client-facing) total, extract the cleaner earnings.
 * Cleaner gets 90% of the listed rate (after removing service fee).
 */
export function getCleanerEarnings(displayedTotal: number): number {
  const listed = displayedTotal * (1 - SERVICE_FEE_PERCENT / 100);
  const earnings = listed * (1 - PLATFORM_COMMISSION_PERCENT / 100);
  return Math.round(earnings * 100) / 100;
}

/**
 * From a displayed total, extract the platform commission (10% of listed rate).
 */
export function getPlatformFee(displayedTotal: number): number {
  const listed = displayedTotal * (1 - SERVICE_FEE_PERCENT / 100);
  return Math.round(listed * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
}

/**
 * From a displayed total, extract the service fee (6% of total).
 */
export function getCustomerServiceFee(displayedTotal: number): number {
  return Math.round(displayedTotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Full price breakdown.
 *
 * Client view: they see `listedSubtotal` (the cleaner's set rate × duration)
 * + `serviceFee` (6% of total) = `total`. They never see `cleanerEarnings` or `platformCommission`.
 *
 * Cleaner/admin view: also includes `cleanerEarnings` and `platformCommission`.
 */
export function getPriceBreakdown(
  cleanerRate: number,
  duration: number,
  serviceMultiplier: number
) {
  // Listed subtotal is the cleaner's rate × duration × multiplier (what the client sees)
  const listedSubtotal = Math.round(cleanerRate * duration * serviceMultiplier * 100) / 100;
  // Platform takes 10% from the listed subtotal
  const platformCommission =
    Math.round(listedSubtotal * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
  // Cleaner gets the rest
  const cleanerEarnings = Math.round((listedSubtotal - platformCommission) * 100) / 100;
  // Service fee is 6% of the final total (inclusive): total = listed / 0.94
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
