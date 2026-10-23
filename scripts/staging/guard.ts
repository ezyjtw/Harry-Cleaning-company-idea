// STAGING ONLY: the refusal rules for scripts/staging/seed.ts, pure so they
// are unit-tested (src/lib/ci/staging-seed-guard.test.ts). The seed writes
// only when this returns no refusals. Production never carries the staging
// marker, its address and database are production ones, and its Stripe key
// is live: any one of those alone refuses.

export type SeedEnv = Partial<
  Record<
    | 'RENA_STAGING_SEED'
    | 'NEXTAUTH_URL'
    | 'DATABASE_URL'
    | 'STRIPE_SECRET_KEY'
    | 'STAGING_SEED_PASSWORD',
    string
  >
>;

export const STAGING_SEED_MARKER = 'rena-staging';
/** Production's private database host: named so it can never pass. */
export const PRODUCTION_DB_HOSTS = ['postgres-lipq.railway.internal'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Every reason the seed must not run against this environment. */
export function seedRefusals(env: SeedEnv): string[] {
  const fails: string[] = [];
  const authUrl = env.NEXTAUTH_URL ?? '';
  const dbUrl = env.DATABASE_URL ?? '';
  const authHost = hostOf(authUrl);
  const dbHost = hostOf(dbUrl);
  if (env.RENA_STAGING_SEED !== STAGING_SEED_MARKER)
    fails.push(`RENA_STAGING_SEED is not ${STAGING_SEED_MARKER}`);
  if (!/(^|[.-])staging([.-]|$)/.test(authHost) && authHost !== 'localhost')
    fails.push('NEXTAUTH_URL is not a staging address');
  if (
    [authHost, dbHost].some((h) => h === 'renacleaning.co.uk' || h.endsWith('.renacleaning.co.uk'))
  )
    fails.push('a production hostname is configured');
  if (/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? ''))
    fails.push('a live Stripe key is configured');
  if (!(dbHost.endsWith('.railway.internal') || dbHost === '127.0.0.1' || dbHost === 'localhost'))
    fails.push(`database host ${dbHost || '(none)'} is not staging-internal`);
  if (PRODUCTION_DB_HOSTS.includes(dbHost))
    fails.push('the production database host is configured');
  if ((env.STAGING_SEED_PASSWORD ?? '').length < 12)
    fails.push('STAGING_SEED_PASSWORD missing or shorter than 12');
  return fails;
}

export const SEED_MODES = ['none', 'base', 'offer', 'offer-expiring'] as const;
export type SeedMode = (typeof SEED_MODES)[number];

/** Unset means none: an ordinary staging deploy seeds nothing. */
export function seedMode(raw: string | undefined): SeedMode | null {
  const m = (raw ?? 'none').trim() || 'none';
  return (SEED_MODES as readonly string[]).includes(m) ? (m as SeedMode) : null;
}
