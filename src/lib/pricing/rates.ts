// The platform's rates, as code (B4, RENA-075, D-n). Pure: safe for client
// components. pricing.service reads these; the admin pricing page shows them
// read only. They are not database settings: a change is a code change,
// reviewed and ruled.

export type CommissionSlug = 'regular' | 'same-day' | 'deep' | 'eot' | 'airbnb';

/** Rena's commission on the cleaner's own price, per service. */
export const COMMISSION_RATES: Record<CommissionSlug, number> = {
  regular: 0.1,
  'same-day': 0.1,
  deep: 0.1,
  eot: 0.15,
  airbnb: 0.15,
};

/** The customer service fee, shown only at checkout and in the pricing example. */
export const PLATFORM_FEE_RATE = 0.06;

/** The products add-on: a £5 charge with its own 10% commission (cleaner keeps 90%). */
export const PRODUCTS_FEE = 5;
export const PRODUCTS_FEE_COMMISSION_RATE = 0.1;

/**
 * PlatformConfig keys an admin may edit. Scheduler markers (day and week
 * guards) are never editable: a hand edit would re-run or skip a batch.
 */
export const EDITABLE_PLATFORM_CONFIG_KEYS = [
  'same_day_multiplier',
  'one_off_multiplier',
  'fortnightly_multiplier',
  'deep_multiplier',
  'min_cleaner_rate',
  'max_cleaner_rate',
  'hq_api_amber_pct',
] as const;
