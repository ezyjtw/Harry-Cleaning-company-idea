// Pricing model:
//   1. Platform markup (10%) — baked into the listed rate the client sees.
//      The cleaner sets £15/hr → client sees £16.50/hr. The cleaner knows
//      about this; the client does NOT see it as a separate line item.
//   2. Service fee (5%) — added at checkout on the listed rate. The client
//      IS aware of this fee.

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
 * Calculate the 5% service fee on a given amount.
 */
export function getServiceFee(amount: number): number {
  return Math.round(amount * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Convert a cleaner's rate to the total the client pays
 * (listed rate + 5% service fee).
 */
export function getDisplayedRate(cleanerNetRate: number): number {
  const listed = getListedRate(cleanerNetRate);
  return Math.round((listed + getServiceFee(listed)) * 100) / 100;
}

/**
 * From a displayed (client-facing) total, extract the cleaner earnings.
 */
export function getCleanerEarnings(displayedTotal: number): number {
  const factor = (1 + PLATFORM_COMMISSION_PERCENT / 100) * (1 + SERVICE_FEE_PERCENT / 100);
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
 * From a displayed total, extract the service fee (5% of listed rate).
 */
export function getCustomerServiceFee(displayedTotal: number): number {
  const cleanerEarnings = getCleanerEarnings(displayedTotal);
  const commission = getPlatformFee(displayedTotal);
  const listedRate = cleanerEarnings + commission;
  return Math.round(listedRate * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Full price breakdown.
 *
 * Client view: they see `listedRate` (which already includes the 10% markup)
 * + `serviceFee` (5%) = `total`. They never see `cleanerEarnings` or `platformCommission`.
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
  const serviceFee = Math.round(listedSubtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
  const total = Math.round((listedSubtotal + serviceFee) * 100) / 100;

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
