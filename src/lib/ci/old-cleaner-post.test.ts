import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// RENA-102 (B6, D-ag): the old application path POST /api/cleaners is
// retired. /join finalises through /api/cleaners/application/submit; the
// directory search (GET) stays. Next answers 405 for a method a route does
// not export, so the proof is: no POST export, and no caller anywhere.
const ROOT = join(__dirname, '..', '..', '..');
const ROUTE = join(ROOT, 'src/app/api/cleaners/route.ts');

describe('POST /api/cleaners is retired', () => {
  it('the route exports GET only', () => {
    const src = readFileSync(ROUTE, 'utf8');
    const exported = Array.from(src.matchAll(/^export (?:async )?function (\w+)/gm), (m) => m[1]);
    expect(exported).toEqual(['GET']);
  });

  it('no web page, component or either shell sends a POST to it', () => {
    const hits: string[] = [];
    const scan = (dir: string) => {
      for (const n of readdirSync(dir)) {
        if (n === 'node_modules' || n.startsWith('.')) continue;
        const p = join(dir, n);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.test.ts')) {
          const s = readFileSync(p, 'utf8');
          // A fetch of the bare path with a method, or a form posting to it.
          if (
            /['"`]\/api\/cleaners['"`]\s*,\s*\{[^}]*method/.test(s) ||
            /action=["']\/api\/cleaners["']/.test(s)
          )
            hits.push(relative(ROOT, p));
        }
      }
    };
    for (const d of ['src', 'components', 'mobile', 'mobile-customer']) scan(join(ROOT, d));
    expect(hits).toEqual([]);
  });
});
