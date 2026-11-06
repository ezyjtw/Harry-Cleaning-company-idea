import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROCESSORS } from './processors';

// B7.8 (RENA-072): the page names every processor the code uses; the table
// names only processors the code actually reads a credential for.
const ROOT = join(__dirname, '..', '..', '..');
// Whitespace collapsed: prettier wraps JSX text, so a two-word name can span lines.
const privacy = readFileSync(join(ROOT, 'src/app/[locale]/privacy/page.tsx'), 'utf8').replace(
  /\s+/g,
  ' '
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const source = walk(join(ROOT, 'src'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

describe('processors on the privacy page (B7.8)', () => {
  it('every processor in the table has its credential or connection read somewhere in src', () => {
    for (const p of PROCESSORS) expect(source, p.name).toContain(p.evidence);
  });

  it('the privacy page names every processor, the ICO complaint right and the ruled storage sentence', () => {
    for (const p of PROCESSORS) expect(privacy, p.name).toContain(p.name);
    expect(privacy).toContain('Information Commissioner');
    expect(privacy).toContain('ico.org.uk');
    expect(privacy).toContain('Our primary application database is hosted in the Netherlands');
    expect(privacy).not.toContain('primarily stored and processed in the United Kingdom');
  });
});
