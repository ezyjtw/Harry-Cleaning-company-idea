import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { seedMode, seedRefusals, STAGING_SEED_MARKER } from '../../../scripts/staging/guard';

// Staging seed gate (James's batch run, 23 Oct): the seed writes only to a
// staging database, and nothing in the product reaches it. Synthetic values
// only; no real key, address or password appears here.
const ROOT = join(__dirname, '..', '..', '..');

const staging = {
  RENA_STAGING_SEED: STAGING_SEED_MARKER,
  NEXTAUTH_URL: 'https://rena-web-staging-staging.up.railway.app',
  DATABASE_URL: 'postgresql://u:p@postgres.railway.internal:5432/railway',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STAGING_SEED_PASSWORD: 'long-enough-pass',
};
const productionShape = {
  NEXTAUTH_URL: 'https://www.renacleaning.co.uk',
  DATABASE_URL: 'postgresql://u:p@postgres-lipq.railway.internal:5432/railway',
  STRIPE_SECRET_KEY: 'sk_live_placeholder',
};

describe('seedRefusals', () => {
  it('a staging environment passes', () => {
    expect(seedRefusals(staging)).toEqual([]);
  });

  it('a production-shaped environment refuses on every count', () => {
    const r = seedRefusals(productionShape);
    expect(r).toEqual(
      expect.arrayContaining([
        'RENA_STAGING_SEED is not rena-staging',
        'NEXTAUTH_URL is not a staging address',
        'a production hostname is configured',
        'a live Stripe key is configured',
        'STAGING_SEED_PASSWORD missing or shorter than 12',
      ])
    );
  });

  it('production still refuses with the marker and a password set by mistake', () => {
    const r = seedRefusals({
      ...productionShape,
      RENA_STAGING_SEED: STAGING_SEED_MARKER,
      STAGING_SEED_PASSWORD: 'long-enough-pass',
    });
    expect(r).toContain('a production hostname is configured');
    expect(r).toContain('a live Stripe key is configured');
    expect(r).toContain('NEXTAUTH_URL is not a staging address');
  });

  it.each([
    ['the marker missing', { RENA_STAGING_SEED: undefined }],
    ['a lookalike marker', { RENA_STAGING_SEED: 'rena-staging ' }],
    ['a production address', { NEXTAUTH_URL: 'https://www.renacleaning.co.uk' }],
    [
      'a production subdomain as the database',
      { DATABASE_URL: 'postgresql://u:p@db.renacleaning.co.uk:5432/x' },
    ],
    ['staging only in the path', { NEXTAUTH_URL: 'https://example.com/staging' }],
    ['staging inside a longer word', { NEXTAUTH_URL: 'https://prestaging.example.com' }],
    [
      'the production database host, all else staging',
      { DATABASE_URL: 'postgresql://u:p@postgres-lipq.railway.internal:5432/railway' },
    ],
    [
      'the public database proxy',
      { DATABASE_URL: 'postgresql://u:p@shuttle.proxy.rlwy.net:44594/railway' },
    ],
    ['an unparseable database url', { DATABASE_URL: 'not a url' }],
    ['a live restricted key', { STRIPE_SECRET_KEY: 'rk_live_placeholder' }],
    ['a short password', { STAGING_SEED_PASSWORD: 'short' }],
  ])('refuses %s', (_label, change) => {
    expect(seedRefusals({ ...staging, ...change }).length).toBeGreaterThan(0);
  });
});

describe('seedMode', () => {
  it.each([
    [undefined, 'none'],
    ['', 'none'],
    ['none', 'none'],
    ['base', 'base'],
    ['offer', 'offer'],
    ['offer-expiring', 'offer-expiring'],
    ['BASE', null],
    ['drop', null],
  ])('%s -> %s', (raw, want) => {
    expect(seedMode(raw)).toBe(want);
  });
});

describe('zero production reach', () => {
  it('no product code, config or npm script references the staging scripts', () => {
    const hits: string[] = [];
    const scan = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.(ts|tsx|js|mjs|json)$/.test(name) && !/\.test\.ts$/.test(name)) {
          if (/scripts\/staging|staging\/seed|RENA_STAGING_SEED/.test(readFileSync(p, 'utf8')))
            hits.push(relative(ROOT, p));
        }
      }
    };
    for (const d of ['src', 'prisma', 'components', 'mobile', 'mobile-customer'])
      scan(join(ROOT, d));
    for (const f of [
      'package.json',
      'railway.json',
      'next.config.js',
      'next.config.mjs',
      'instrumentation.ts',
    ]) {
      try {
        if (/scripts\/staging|RENA_STAGING_SEED/.test(readFileSync(join(ROOT, f), 'utf8')))
          hits.push(f);
      } catch {
        /* absent file */
      }
    }
    expect(hits).toEqual([]);
  });
});
