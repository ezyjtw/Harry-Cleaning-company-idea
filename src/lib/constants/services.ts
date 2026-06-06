// ─── Canonical Service Type Slugs ────────────────────────────────
// These are the ONLY values stored in CleanerProfile.serviceTypes and
// used across the pricing service, search API, and booking API.

export const SERVICE_TYPE_SLUGS = [
  'regular',
  'deep',
  'same_day',
  'end_of_tenancy',
  'airbnb',
] as const;

export type ServiceTypeSlug = (typeof SERVICE_TYPE_SLUGS)[number];

const SERVICE_TYPE_LABELS: Record<ServiceTypeSlug, string> = {
  regular: 'Regular Cleaning',
  deep: 'Deep Cleaning',
  same_day: 'Same-Day Cleaning',
  end_of_tenancy: 'End of Tenancy',
  airbnb: 'Airbnb / Short-Let',
};

export function serviceTypeLabel(slug: ServiceTypeSlug): string {
  return SERVICE_TYPE_LABELS[slug];
}

export function isServiceTypeSlug(value: string): value is ServiceTypeSlug {
  return (SERVICE_TYPE_SLUGS as readonly string[]).includes(value);
}

// Maps UI labels (from legacy forms) to canonical slugs.
// Used at write boundaries to normalize before saving.
const SERVICE_TYPE_FROM_LABEL: Record<string, ServiceTypeSlug> = {
  Standard: 'regular',
  'Regular Cleaning': 'regular',
  Deep: 'deep',
  'Deep Cleaning': 'deep',
  'Same Day': 'same_day',
  'Same-Day Cleaning': 'same_day',
  'End of Tenancy': 'end_of_tenancy',
  AirBnB: 'airbnb',
  'Airbnb / Short-Let': 'airbnb',
  Airbnb: 'airbnb',
  // Passthrough for already-canonical values
  regular: 'regular',
  deep: 'deep',
  same_day: 'same_day',
  end_of_tenancy: 'end_of_tenancy',
  airbnb: 'airbnb',
};

export function normalizeServiceType(label: string): ServiceTypeSlug {
  const slug = SERVICE_TYPE_FROM_LABEL[label];
  if (!slug) throw new Error(`Unrecognized service type: "${label}"`);
  return slug;
}

// ─── Canonical Property Size Slugs ───────────────────────────────

export const EOT_SIZE_SLUGS = ['studio', '1bed', '2bed', '3bed', '4bed', '5bedPlus'] as const;

export type EotSizeSlug = (typeof EOT_SIZE_SLUGS)[number];

export const AIRBNB_SIZE_SLUGS = ['studio', '1bed', '2bed', '3bed', '4bedPlus'] as const;

export type AirbnbSizeSlug = (typeof AIRBNB_SIZE_SLUGS)[number];

const EOT_SIZE_LABELS: Record<EotSizeSlug, string> = {
  studio: 'Studio',
  '1bed': '1 Bed',
  '2bed': '2 Bed',
  '3bed': '3 Bed',
  '4bed': '4 Bed',
  '5bedPlus': '5 Bed+',
};

const AIRBNB_SIZE_LABELS: Record<AirbnbSizeSlug, string> = {
  studio: 'Studio',
  '1bed': '1 Bed',
  '2bed': '2 Bed',
  '3bed': '3 Bed',
  '4bedPlus': '4 Bed+',
};

export function eotSizeLabel(slug: EotSizeSlug): string {
  return EOT_SIZE_LABELS[slug];
}

export function airbnbSizeLabel(slug: AirbnbSizeSlug): string {
  return AIRBNB_SIZE_LABELS[slug];
}

// Maps UI labels (from legacy pricing page) to canonical slugs
const EOT_SIZE_FROM_LABEL: Record<string, EotSizeSlug> = {
  Studio: 'studio',
  '1 bed': '1bed',
  '2 bed': '2bed',
  '3 bed': '3bed',
  '4 bed': '4bed',
  '5 bed+': '5bedPlus',
  // Passthrough for already-canonical values
  studio: 'studio',
  '1bed': '1bed',
  '2bed': '2bed',
  '3bed': '3bed',
  '4bed': '4bed',
  '5bedPlus': '5bedPlus',
};

const AIRBNB_SIZE_FROM_LABEL: Record<string, AirbnbSizeSlug> = {
  Studio: 'studio',
  '1 bed': '1bed',
  '2 bed': '2bed',
  '3 bed': '3bed',
  '4 bed+': '4bedPlus',
  // Passthrough for already-canonical values
  studio: 'studio',
  '1bed': '1bed',
  '2bed': '2bed',
  '3bed': '3bed',
  '4bedPlus': '4bedPlus',
};

export function normalizeEotSize(label: string): EotSizeSlug {
  const slug = EOT_SIZE_FROM_LABEL[label];
  if (!slug) throw new Error(`Unrecognized EoT property size: "${label}"`);
  return slug;
}

export function normalizeAirbnbSize(label: string): AirbnbSizeSlug {
  const slug = AIRBNB_SIZE_FROM_LABEL[label];
  if (!slug) throw new Error(`Unrecognized Airbnb property size: "${label}"`);
  return slug;
}

// Maps numeric bedroom count → canonical property size slugs.
// Used by HeroQuoteWidget and BackupCleanerSlider.
export const BEDROOMS_TO_EOT_SIZE: Record<number, EotSizeSlug> = {
  0: 'studio',
  1: '1bed',
  2: '2bed',
  3: '3bed',
  4: '4bed',
  5: '5bedPlus',
};

export const BEDROOMS_TO_AIRBNB_SIZE: Record<number, AirbnbSizeSlug> = {
  0: 'studio',
  1: '1bed',
  2: '2bed',
  3: '3bed',
  4: '4bedPlus',
};

// ─── Booking Service Slug Normalization ──────────────────────────
// Maps booking-form service values (kebab-case) to pricing-service
// ServiceSlug values. Used by the booking API.

export type PricingServiceSlug = 'regular' | 'one-off' | 'same-day' | 'deep' | 'eot' | 'airbnb';

const BOOKING_TO_PRICING_SLUG: Record<string, PricingServiceSlug> = {
  regular: 'regular',
  'one-off': 'one-off',
  'same-day': 'same-day',
  deep: 'deep',
  eot: 'eot',
  airbnb: 'airbnb',
  'end-of-tenancy': 'eot',
  end_of_tenancy: 'eot',
  same_day: 'same-day',
};

export function normalizeToPricingSlug(serviceType: string): PricingServiceSlug {
  const slug = BOOKING_TO_PRICING_SLUG[serviceType];
  if (!slug) throw new Error(`Unrecognized service type for pricing: "${serviceType}"`);
  return slug;
}

// ─── EOT / Airbnb Guide Prices (for pricing page UI) ────────────

export const EOT_SIZES_WITH_GUIDE: { slug: EotSizeSlug; guide: string }[] = [
  { slug: 'studio', guide: '£150 – £200' },
  { slug: '1bed', guide: '£190 – £240' },
  { slug: '2bed', guide: '£250 – £300' },
  { slug: '3bed', guide: '£320 – £380' },
  { slug: '4bed', guide: '£390 – £450' },
  { slug: '5bedPlus', guide: '£480 – £580' },
];

export const AIRBNB_SIZES_WITH_GUIDE: { slug: AirbnbSizeSlug; guide: string }[] = [
  { slug: 'studio', guide: '£45 – £65' },
  { slug: '1bed', guide: '£55 – £85' },
  { slug: '2bed', guide: '£75 – £110' },
  { slug: '3bed', guide: '£95 – £140' },
  { slug: '4bedPlus', guide: '£130 – £165' },
];

// ─── Service Rate Info (for pricing page UI) ─────────────────────
// Maps serviceType slugs to display info for the cleaner pricing page.

export interface ServiceRateInfo {
  label: string;
  range: string;
  hourly: boolean;
}

export const SERVICE_RATE_INFO: Record<ServiceTypeSlug, ServiceRateInfo> = {
  regular: { label: 'Regular Cleaning', range: '£14 – £35/hr', hourly: true },
  deep: { label: 'Deep Cleaning', range: '£20 – £51/hr', hourly: true },
  same_day: { label: 'Same-Day Cleaning', range: '£18 – £46/hr', hourly: true },
  end_of_tenancy: { label: 'End of Tenancy', range: '£150 – £580', hourly: false },
  airbnb: { label: 'Airbnb / Short-Let', range: '£45 – £165', hourly: false },
};
