import { test, expect } from '@playwright/test';

import { PUBLIC_ROUTES } from '../src/lib/ci/public-routes';

// Hash law: CI reads the same canonical list as CLAUDE.md and the hash tool.
// Every baselined public route answers 200 to a signed-out visitor.
test.describe('baselined public routes (hash law)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} answers 200`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(200);
    });
  }
});
