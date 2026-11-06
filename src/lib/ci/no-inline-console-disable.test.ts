import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// B7.13 (RENA-085): the inline no-console disables in src/lib and src/app/api
// are gone for good; every line goes through log.ts. The one sanctioned sink
// is log.ts itself (a block disable around the console call).
const ROOT = join(__dirname, '..', '..', '..');
// The one exception: the H39 browser-side navigation trap writes to the
// browser console on purpose and cannot import log.ts (Node crypto). It is
// excluded from the lint override by name and listed here by name; it goes
// when H39 closes.
const BROWSER_DIAGNOSTIC = 'src/lib/nav/nav-trace.ts';
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('no inline console disables (B7.13)', () => {
  it('src/lib and src/app/api carry zero "eslint-disable-next-line no-console"', () => {
    const offenders: string[] = [];
    for (const dir of ['src/lib', 'src/app/api']) {
      for (const f of walk(join(ROOT, dir))) {
        if (f.endsWith('src/lib/log.ts') || f.endsWith(BROWSER_DIAGNOSTIC)) continue;
        const text = readFileSync(f, 'utf8');
        if (
          text.includes('eslint-disable-next-line no-console') ||
          /eslint-disable(?!-)[^\n]*no-console/.test(text)
        ) {
          offenders.push(f.replace(`${ROOT}/`, ''));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('log.ts is the only file in those roots that calls console', () => {
    const callers: string[] = [];
    for (const dir of ['src/lib', 'src/app/api']) {
      for (const f of walk(join(ROOT, dir))) {
        if (/console\.(log|info|warn|error|debug)\(/.test(readFileSync(f, 'utf8'))) {
          callers.push(f.replace(`${ROOT}/`, ''));
        }
      }
    }
    expect(callers.sort()).toEqual([BROWSER_DIAGNOSTIC, 'src/lib/log.ts'].sort());
  });
});
