import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EDITABLE_PLATFORM_CONFIG_KEYS } from '@/lib/pricing/rates';

// B6 (D-ad, James-ruled 2026-10-07): the pricing dead furniture stays gone.
// Prices are each cleaner's own; FixedServicePrice keeps only estimatedHours
// (the LB-6 calendar hold) and no multiplier key exists anywhere.
const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const MULTIPLIER_KEYS = [
  'same_day_multiplier',
  'one_off_multiplier',
  'fortnightly_multiplier',
  'deep_multiplier',
];

describe('pricing dead furniture', () => {
  it('the schema and the reference seed carry no customer price column', () => {
    const model = read('prisma/schema.prisma').match(/model FixedServicePrice \{[^}]*\}/)?.[0];
    expect(model).toBeDefined();
    expect(model).not.toMatch(/customerPrice/);
    expect(model).toMatch(/estimatedHours/);
    expect(read('prisma/seed-reference-data.ts')).not.toMatch(/customerPrice/);
  });

  it('no multiplier key is seeded or admin editable', () => {
    const seed = read('prisma/seed-reference-data.ts');
    for (const k of MULTIPLIER_KEYS) expect(seed).not.toContain(`'${k}'`);
    for (const k of MULTIPLIER_KEYS)
      expect(EDITABLE_PLATFORM_CONFIG_KEYS as readonly string[]).not.toContain(k);
  });

  it('a migration drops the column and deletes the four rows', () => {
    const dir = join(ROOT, 'prisma/migrations');
    const sql = readdirSync(dir)
      .filter((d) => statSync(join(dir, d)).isDirectory())
      .map((d) => readFileSync(join(dir, d, 'migration.sql'), 'utf8'))
      .join('\n');
    expect(sql).toMatch(/ALTER TABLE "FixedServicePrice" DROP COLUMN "customerPrice"/);
    for (const k of MULTIPLIER_KEYS)
      expect(sql).toMatch(new RegExp(`DELETE FROM "PlatformConfig"[^;]*'${k}'`));
  });

  it('/api/pricing/services selects only what its callers read', () => {
    const src = read('src/app/api/pricing/services/route.ts');
    expect(src).not.toMatch(/include:/);
    expect(src).toMatch(
      /fixedPrices: \{ select: \{ propertySize: true, estimatedHours: true \} \}/
    );
  });

  it('no product source reads a customer price or a multiplier key', () => {
    const hits: string[] = [];
    const scan = (dir: string) => {
      for (const n of readdirSync(dir)) {
        if (n === 'node_modules' || n.startsWith('.')) continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts')) {
          const s = readFileSync(p, 'utf8');
          if (/customerPrice\b/.test(s) || MULTIPLIER_KEYS.some((k) => s.includes(k)))
            hits.push(relative(ROOT, p));
        }
      }
    };
    for (const d of ['src', 'components', 'prisma']) scan(join(ROOT, d));
    expect(hits).toEqual([]);
  });
});
