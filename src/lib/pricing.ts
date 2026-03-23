// Platform fee configuration
// Two separate fees:
//   1. Platform commission (10%) — added on top of the cleaner's rate, goes to Rena
//   2. Service fee (5%) — charged to the customer on the subtotal
// Both fees are shown transparently in the price breakdown.

/** @server-only — do not import in client components */
export const PLATFORM_COMMISSION_PERCENT = 10;
export const SERVICE_FEE_PERCENT = 5;

/**
 * From a cleaner's net rate, calculate the subtotal the customer sees
 * (cleaner rate + 10% platform commission).
 */
export function getSubtotal(cleanerNetRate: number): number {
  return Math.round(cleanerNetRate * (1 + PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
}

/**
 * Calculate the 5% service fee on the subtotal.
 */
export function getServiceFee(subtotal: number): number {
  return Math.round(subtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Convert a cleaner's net rate to the total displayed to customers
 * (cleaner rate + 10% commission + 5% service fee).
 */
export function getDisplayedRate(cleanerNetRate: number): number {
  const subtotal = getSubtotal(cleanerNetRate);
  return Math.round((subtotal + getServiceFee(subtotal)) * 100) / 100;
}

/**
 * From a displayed (customer-facing) total, extract the cleaner earnings.
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
 * From a displayed total, extract the service fee (5% of subtotal).
 */
export function getCustomerServiceFee(displayedTotal: number): number {
  const cleanerEarnings = getCleanerEarnings(displayedTotal);
  const commission = getPlatformFee(displayedTotal);
  const subtotal = cleanerEarnings + commission;
  return Math.round(subtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
}

/**
 * Get full price breakdown — visible to customers and admin.
 */
export function getPriceBreakdown(
  cleanerRate: number,
  duration: number,
  serviceMultiplier: number
) {
  const cleanerEarnings = Math.round(cleanerRate * duration * serviceMultiplier * 100) / 100;
  const platformCommission =
    Math.round(cleanerEarnings * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
  const subtotal = cleanerEarnings + platformCommission;
  const serviceFee = Math.round(subtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  return {
    cleanerRate,
    duration,
    serviceMultiplier,
    cleanerEarnings,
    platformCommission,
    platformCommissionPercent: PLATFORM_COMMISSION_PERCENT,
    subtotal,
    serviceFee,
    serviceFeePercent: SERVICE_FEE_PERCENT,
    total,
  };
}
