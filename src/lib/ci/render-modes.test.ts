import { describe, expect, it } from 'vitest';

import { PUBLIC_ROUTES } from './public-routes';
import { ISR_ROUTES, modeDifferences } from './render-modes';

describe('the RENA-051 render mode table', () => {
  it('names only baselined public routes', () => {
    for (const r of Object.keys(ISR_ROUTES)) expect(PUBLIC_ROUTES).toContain(r);
  });

  it('accepts a manifest that matches and names each kind of drift', () => {
    const routes = Object.fromEntries(
      Object.entries(ISR_ROUTES).map(([r, s]) => [`/en${r}`, { initialRevalidateSeconds: s }])
    ) as Record<string, { initialRevalidateSeconds: number | false }>;
    expect(
      modeDifferences({ routes: { ...routes, '/robots.txt': { initialRevalidateSeconds: false } } })
    ).toEqual([]);
    const { ['/en/about']: _gone, ...missing } = routes;
    expect(modeDifferences({ routes: missing })).toEqual([
      '/about: expected ISR 3600, got dynamic',
    ]);
    expect(
      modeDifferences({ routes: { ...routes, '/en': { initialRevalidateSeconds: 3600 } } })
    ).toEqual(['/: prerendered but not in the table']);
  });
});
