import { expect, test } from '@playwright/test';

import { hasFixtures, isolateRateBucket, signIn } from './fixtures';

test.beforeEach(async ({ page }) => {
  await isolateRateBucket(page);
});

// RENA-048 (B2a): Account A, sign out, Account B, network failure: nothing of
// A's API traffic may survive in Cache Storage or be served to B. The cleaners
// directory API is the probe: personalised per viewer and, before v6, cached.
// Proven failing on the v5 worker at the gate.
test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

const DIRECTORY_API = '/api/cleaners?postcode=E4+9AA&limit=50';

test('account switch then offline never serves the first account its API data', async ({
  page,
  context,
}) => {
  await signIn(page, 'customerA');
  await page.goto('/cleaners?postcode=E4%209AA');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
    timeout: 30000,
  });
  // A second load runs every request through the now-controlling worker.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.evaluate((u) => fetch(u).then((r) => r.status), DIRECTORY_API);

  await context.clearCookies(); // A signs out
  await signIn(page, 'customerB');

  const inventory = await page.evaluate(async () => {
    const keys = await caches.keys();
    const api: string[] = [];
    for (const k of keys) {
      const c = await caches.open(k);
      for (const r of await c.keys()) {
        if (new URL(r.url).pathname.startsWith('/api/')) api.push(r.url);
      }
    }
    return { keys, api };
  });
  expect(inventory.keys.filter((k) => k !== 'rena-static-v6')).toEqual([]);
  expect(inventory.api).toEqual([]);

  await context.setOffline(true);
  const offline = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u);
      return { served: true, status: r.status };
    } catch {
      return { served: false };
    }
  }, DIRECTORY_API);
  expect(offline).toEqual({ served: false });

  await page.goto('/account').catch(() => undefined);
  await expect(page.locator('body')).not.toContainText('Alpha');
  await context.setOffline(false);
});
