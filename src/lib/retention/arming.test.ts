import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EDITABLE_PLATFORM_CONFIG_KEYS } from '@/lib/pricing/rates';

import { ARMED, DRY_RUN, RETENTION_MODE_KEY } from './arming';

// B7b delta (the second auditor's safety amendment): the arming state is
// code-owned and cannot become armed by a deploy, a seed, an admin screen or
// elapsed time. These checks pin each of those doors shut.
const ROOT = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(p);
  }
  return out;
}

describe('retention arming gate (B7b delta)', () => {
  it('the key is outside the editable PlatformConfig allowlist', () => {
    expect((EDITABLE_PLATFORM_CONFIG_KEYS as readonly string[]).includes(RETENTION_MODE_KEY)).toBe(
      false
    );
  });

  it('no seed and no migration names the key, so a deploy cannot set it', () => {
    const seed = readFileSync(join(ROOT, 'prisma/seed-reference-data.ts'), 'utf8');
    expect(seed).not.toContain(RETENTION_MODE_KEY);
    for (const f of walk(join(ROOT, 'prisma/migrations'))) {
      expect(readFileSync(f, 'utf8'), f).not.toContain(RETENTION_MODE_KEY);
    }
  });

  it('no code path writes the armed value: the only writer creates the row as dry_run', () => {
    const files = walk(join(ROOT, 'src')).filter((f) => !f.endsWith('.test.ts'));
    const writers = files.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return (
        t.includes(RETENTION_MODE_KEY) &&
        /platformConfig\s*\.\s*(create|update|upsert|updateMany)\b/.test(t)
      );
    });
    expect(writers.map((f) => f.replace(`${ROOT}/`, ''))).toEqual(['src/lib/retention/arming.ts']);
    const arming = readFileSync(join(ROOT, 'src/lib/retention/arming.ts'), 'utf8');
    expect(arming).toContain(`value: DRY_RUN`);
    expect(arming).not.toMatch(/value:\s*ARMED/);
    expect(DRY_RUN).toBe('dry_run');
    expect(ARMED).toBe('armed');
  });
});
