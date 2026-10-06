import { test, expect, type Page } from '@playwright/test';

// RENA-059 (D-b, B1b): nothing analytics-related without stored consent.
// Counts POSTs to /api/analytics/events and checks the session-id write on a
// funnel page (/services/regular, the Decision-1 funnel mount) and the cleaner
// wizard (/join). Signed-out visitors here; the signed-in and in-shell legs
// are driven on the rig and reported in the gate.
const FUNNEL = '/services/regular';
const SHELL_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RenaApp/1.0.1';

function countEvents(page: Page): { n: number } {
  const counter = { n: 0 };
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/analytics/events')) counter.n += 1;
  });
  return counter;
}

async function sessionIdWritten(page: Page): Promise<boolean> {
  return page.evaluate(() => sessionStorage.getItem('rena_session_id') !== null);
}

test.describe('analytics consent (RENA-059)', () => {
  test('no choice: zero events, no session id, banner shown', async ({ page }) => {
    const c = countEvents(page);
    await page.goto(FUNNEL);
    await expect(page.getByRole('button', { name: 'Accept All' })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.goto('/join');
    await page.waitForTimeout(1500);
    expect(c.n).toBe(0);
    expect(await sessionIdWritten(page)).toBe(false);
  });

  test('Essential only: zero events after the choice, across reloads', async ({ page }) => {
    const c = countEvents(page);
    await page.goto(FUNNEL);
    await page.getByRole('button', { name: 'Essential Only' }).click();
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Accept All' })).toHaveCount(0);
    expect(c.n).toBe(0);
    expect(await sessionIdWritten(page)).toBe(false);
  });

  test('Accept All: events flow and the session id is written', async ({ page }) => {
    const c = countEvents(page);
    await page.goto(FUNNEL);
    await page.getByRole('button', { name: 'Accept All' }).click();
    await page.reload();
    await expect.poll(() => c.n, { timeout: 8000 }).toBeGreaterThan(0);
    expect(await sessionIdWritten(page)).toBe(true);
  });

  test('in-shell user agent, signed out: no banner and zero events', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: SHELL_UA });
    const page = await context.newPage();
    const c = countEvents(page);
    await page.goto(FUNNEL);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: 'Accept All' })).toHaveCount(0);
    expect(c.n).toBe(0);
    expect(await sessionIdWritten(page)).toBe(false);
    await context.close();
  });
});
