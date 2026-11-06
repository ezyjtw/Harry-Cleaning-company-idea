// B7.8 (RENA-072): the third-party services that handle data for Rena, read
// from the code, grouped by purpose. This is a TECHNICAL inventory (which
// service receives which data), not a legal classification: whether a given
// service is a processor, a joint controller or an independent controller
// under UK GDPR is a legal determination that waits for the external review
// mandated before B9 (owner governance ruling, register D-ar). The privacy page section 4 names every row and
// src/lib/privacy/processors.test.ts checks the page against this table and
// the table against the environment variables the code reads. Region, DPA
// status and renewal are facts James enters in docs/ops/processors.md; they
// are not asserted here.
export interface Processor {
  name: string;
  purpose: string;
  /** The environment variable or module that proves the integration exists in code. */
  evidence: string;
  dataCategories: string;
}

export const PROCESSORS: readonly Processor[] = [
  {
    name: 'Stripe',
    purpose: 'payments and cleaner payouts',
    evidence: 'STRIPE_SECRET_KEY',
    dataCategories: 'name, email, payment and payout details, booking amounts',
  },
  {
    name: 'Railway',
    purpose: 'hosting and the application database',
    evidence: 'DATABASE_URL',
    dataCategories: 'all platform data',
  },
  {
    name: 'Cloudflare',
    purpose: 'network edge and encrypted document storage (R2)',
    evidence: 'R2_BUCKET_NAME',
    dataCategories: 'request metadata; encrypted identity and insurance documents',
  },
  {
    name: 'Resend',
    purpose: 'transactional email',
    evidence: 'RESEND_API_KEY',
    dataCategories: 'email address, name, booking details in messages',
  },
  {
    name: 'Twilio',
    purpose: 'SMS notifications',
    evidence: 'TWILIO_ACCOUNT_SID',
    dataCategories: 'phone number, booking reminders',
  },
  {
    name: 'Expo',
    purpose: 'push notifications to the apps',
    evidence: 'EXPO_ACCESS_TOKEN',
    dataCategories: 'push tokens, notification titles',
  },
  {
    name: 'Sentry',
    purpose: 'error reporting (when enabled)',
    evidence: 'SENTRY_DSN',
    dataCategories: 'error traces with identifiers scrubbed',
  },
  {
    name: 'Groq',
    purpose: 'the website chat assistant',
    evidence: 'GROQ_API_KEY',
    dataCategories: 'the text you type to the assistant',
  },
  {
    name: 'OpenRouteService',
    purpose: 'travel time and catchment calculation',
    evidence: 'ORS_API_KEY',
    dataCategories: 'postcodes and coordinates',
  },
  {
    name: 'Google Places',
    purpose: 'area and competitor information for operations',
    evidence: 'GOOGLE_PLACES_API_KEY',
    dataCategories: 'place names and locations, no customer data',
  },
  {
    name: 'Xero',
    purpose: 'accounting',
    evidence: 'XERO_CLIENT_ID',
    dataCategories: 'booking amounts, fees and payouts',
  },
];
