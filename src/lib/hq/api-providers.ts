// R9 (HQ API room): the provider registry — one row per outbound provider,
// carrying the DOCUMENTED limits (the census, Phase 1 ratified) and the
// next-tier pricing note the room shows. Limits here are display/threshold
// data only; nothing enforces from this file.

export interface ApiProviderInfo {
  key: string; // matches ApiCallLog.provider
  label: string;
  /** documented free/current-tier daily ceiling, when one exists */
  limitPerDay?: number;
  /** documented monthly ceiling, when that is the published unit */
  limitPerMonth?: number;
  /** one-line statement of the documented limits */
  limitNote: string;
  /** what the next tier costs, per the provider's published pricing */
  nextTierNote: string;
  /** honest caveats the room must show (e.g. browser-direct postcodes) */
  caveat?: string;
  /** true while the integration is dormant (env var unset) */
  dormant?: boolean;
}

export const API_PROVIDERS: ApiProviderInfo[] = [
  {
    key: 'stripe',
    label: 'Stripe',
    limitNote: 'No quota — rate limit 100 read + 100 write/sec (live mode).',
    nextTierNote: 'Pay-per-use (1.5% + 20p UK cards); no call-volume tier to buy.',
  },
  {
    key: 'resend',
    label: 'Email (Resend)',
    limitPerDay: 100,
    limitPerMonth: 3000,
    limitNote: 'Free tier: 100 emails/day, 3,000/month.',
    nextTierNote: 'Pro from ~$20/month for 50,000 emails/month.',
  },
  {
    key: 'postcodes',
    label: 'postcodes.io',
    limitNote: 'Free and open, keyless, fair-use policy — no published quota.',
    nextTierNote: 'None — self-hostable if fair-use is ever outgrown.',
    caveat:
      'Browser-direct lookups from the booking form go straight to postcodes.io and ride alongside uncounted — this series is the server-side calls only.',
  },
  {
    key: 'ors',
    label: 'OpenRouteService',
    limitPerDay: 500,
    limitNote: 'Free tier: 500 isochrone requests/day (~20/min). Generation self-throttles.',
    nextTierNote: 'Collaborative/paid plans on request; self-hosting is free.',
  },
  {
    key: 'groq',
    label: 'Groq (chat)',
    limitNote: 'Free tier ~30 req/min per model; our own chat limiter is 30/hour/IP.',
    nextTierNote: 'Developer tier: pay-per-token (llama-3.3-70b ≈ $0.59/M in, $0.79/M out).',
  },
  {
    key: 'expo_push',
    label: 'Expo push',
    limitNote: 'No quota; ~600 notifications/sec guidance. Dormant until push activation.',
    nextTierNote: 'Free at any volume.',
    dormant: true,
  },
  {
    key: 'xero',
    label: 'Xero',
    limitPerDay: 5000,
    limitNote: '60 calls/min, 5,000/day per tenant (fixed, not purchasable).',
    nextTierNote: 'No higher tier exists — limits are per-tenant constants.',
  },
  {
    key: 'google_places',
    label: 'Google Places (New)',
    limitPerMonth: 1000,
    limitNote:
      'Post-2025 monthly free allowances per SKU (Pro/Enterprise calls in the low thousands free). Our weekly refresh ≈ 250 calls/month.',
    nextTierNote:
      'Beyond free allowance: Text Search (Pro) $32/1k, Place Details (Enterprise) $25/1k.',
    dormant: true, // until GOOGLE_PLACES_API_KEY is set in Railway
  },
  {
    key: 'sentry',
    label: 'Sentry',
    limitNote: 'Listed, not counted — its own dashboard is the meter. 5k events/month free.',
    nextTierNote: 'Team from $26/month.',
    dormant: true, // DSN unset (James-scheduled pre-launch item)
  },
];

export const AMBER_PCT_CONFIG_KEY = 'hq_api_amber_pct';
export const AMBER_PCT_DEFAULT = 80;
