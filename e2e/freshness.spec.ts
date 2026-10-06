import { expect, test, type Page } from '@playwright/test';

import { hasFixtures, isolateRateBucket, signIn } from './fixtures';

test.beforeEach(async ({ page }) => {
  await isolateRateBucket(page);
});

// RENA-018 / RENA-025 (B2a): Home's freshness contract in a browser. The
// 15 s coalescing boundary itself is unit tested (src/lib/freshness.test.ts);
// here: activation inside the window does not refetch, an explicit marker
// does at once, a marker written from another tab arrives by the storage
// event, and Done's ?paid is stripped.
test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

async function openHome(page: Page, query = '') {
  await page
    .context()
    .addCookies([{ name: 'rena-customer-preview', value: '1', url: 'http://localhost:3000' }]);
  const hits: number[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/bookings?pageSize=50')) hits.push(Date.now());
  });
  await page.goto(`/app/home${query}`);
  await page.waitForLoadState('networkidle');
  return hits;
}

test('Done lands on Home with ?paid stripped from the address', async ({ page }) => {
  await signIn(page, 'customerA');
  await openHome(page, '?paid=bk_e2e');
  await expect(page).toHaveURL(/\/app\/home$/);
});

test('activation inside the window does not refetch; an explicit marker does at once', async ({
  page,
}) => {
  await signIn(page, 'customerA');
  const hits = await openHome(page);
  const base = hits.length;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(800);
  expect(hits.length).toBe(base);
  await page.evaluate(() => {
    localStorage.setItem('rena:stale:home', String(Date.now()));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => hits.length).toBe(base + 1);
  expect(await page.evaluate(() => localStorage.getItem('rena:stale:home'))).toBeNull();
});

test('a marker written in another tab reaches Home by the storage event', async ({
  page,
  context,
}) => {
  await signIn(page, 'customerA');
  const hits = await openHome(page);
  const base = hits.length;
  const other = await context.newPage();
  await other.goto('/about');
  await other.evaluate(() => localStorage.setItem('rena:stale:home', String(Date.now())));
  await expect.poll(() => hits.length).toBe(base + 1);
});
