import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PUBLIC_ROUTES, normaliseForHash, routesFromClaudeMd } from './public-routes';

describe('hash law canonical route list', () => {
  it('has exactly 28 unique routes', () => {
    expect(PUBLIC_ROUTES).toHaveLength(28);
    expect(new Set(PUBLIC_ROUTES).size).toBe(28);
  });
  it('CLAUDE.md lists the same routes in the same order (humans and CI cannot diverge)', () => {
    const md = readFileSync('CLAUDE.md', 'utf8');
    expect(routesFromClaudeMd(md)).toEqual([...PUBLIC_ROUTES]);
    expect(md).toContain('All 28 baselined public routes are protected.');
  });
  it('normalisation ignores build-specific script and chunk names but not content', () => {
    const a =
      '<p>Hi</p><script src="/_next/static/abc.js"></script><link href="/_next/static/css/1.css"><img src="/x.png?v=12">';
    const b =
      '<p>Hi</p><script src="/_next/static/zzz.js">x</script><link href="/_next/static/css/2.css"><img src="/x.png?v=99">';
    expect(normaliseForHash(a)).toBe(normaliseForHash(b));
    expect(normaliseForHash(a)).not.toBe(normaliseForHash(a.replace('Hi', 'Hello')));
  });
});
