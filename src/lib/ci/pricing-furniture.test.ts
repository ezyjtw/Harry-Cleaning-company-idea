import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EDITABLE_PLATFORM_CONFIG_KEYS } from '@/lib/pricing/rates';

// B6 (D-ad, James-ruled 2026-10-07; split by the second auditor's condition 1,
// 23 Oct): the pricing dead furniture has no reader and no writer. The
// customerPrice column and the four multiplier rows stay dormant in
// production until their own contraction gate drops them, so B6 ships no
// destructive migration and pre-B6 code stays a safe rollback.
const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const MULTIPLIER_KEYS = [
  'same_day_multiplier',
  'one_off_multiplier',
  'fortnightly_multiplier',
  'deep_multiplier',
];

describe('pricing dead furniture', () => {
  it('the column is dormant: optional in the schema, never written by the seed', () => {
    const model = read('prisma/schema.prisma').match(/model FixedServicePrice \{[^}]*\}/)?.[0];
    expect(model).toBeDefined();
    expect(model).toMatch(/customerPrice\s+Float\?/);
    expect(model).toMatch(/estimatedHours/);
    expect(read('prisma/seed-reference-data.ts')).not.toMatch(/customerPrice/);
  });

  it('no multiplier key is seeded or admin editable', () => {
    const seed = read('prisma/seed-reference-data.ts');
    for (const k of MULTIPLIER_KEYS) expect(seed).not.toContain(`'${k}'`);
    for (const k of MULTIPLIER_KEYS)
      expect(EDITABLE_PLATFORM_CONFIG_KEYS as readonly string[]).not.toContain(k);
  });

  it('no migration drops the column or deletes the rows (that is the contraction gate)', () => {
    const dir = join(ROOT, 'prisma/migrations');
    const sql = readdirSync(dir)
      .filter((d) => statSync(join(dir, d)).isDirectory())
      .map((d) => readFileSync(join(dir, d, 'migration.sql'), 'utf8'))
      .join('\n');
    expect(sql).not.toMatch(/DROP COLUMN "customerPrice"/);
    for (const k of MULTIPLIER_KEYS)
      expect(sql).not.toMatch(new RegExp(`DELETE FROM "PlatformConfig"[^;]*'${k}'`));
    expect(sql).toMatch(
      /ALTER TABLE "FixedServicePrice" ALTER COLUMN "customerPrice" DROP NOT NULL/
    );
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
