import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// B5 (RENA-082, James-ruled): the in-shell customer signup hands the new
// account to the native shell with a single-use code only. A stubbed
// window.ReactNativeWebView collects what the page posts. The website path is
// unchanged and its signup response carries no native credential at all.
const PASSWORD = 'Str0ng!Passw0rd-2026';

async function fillSignup(page: Page, email: string) {
  await page.fill('#firstName', 'Handoff');
  await page.fill('#lastName', 'Person');
  await page.fill('input[type="email"]', email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(PASSWORD);
  if ((await pw.count()) > 1) await pw.nth(1).fill(PASSWORD);
  const terms = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await terms.count()); i += 1) await terms.nth(i).check();
}

test.describe('customer shell signup handoff', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RenaApp/1.0.1',
  });

  test('posts one signedUp message with a handoff code, never navigates to /account; the code redeems natively once', async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __posted: string[];
        ReactNativeWebView: { postMessage(m: string): void };
      };
      w.__posted = [];
      w.ReactNativeWebView = { postMessage: (m: string) => w.__posted.push(m) };
    });
    const email = `e2e-b5-shell-${Date.now()}@integration.invalid`;
    const signupBody = page.waitForResponse((r) => r.url().endsWith('/api/auth/signup'));
    await page.goto('/signup');
    await fillSignup(page, email);
    await page.locator('form button[type="submit"]').click();

    const body = (await (await signupBody).json()) as Record<string, unknown>;
    expect(body.token).toBeUndefined();
    expect(body.bridgeCode).toBeUndefined();

    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __posted: string[] }).__posted.length)
      )
      .toBe(1);
    const posted = JSON.parse(
      await page.evaluate(() => (window as unknown as { __posted: string[] }).__posted[0])
    ) as Record<string, unknown>;
    expect(Object.keys(posted).sort()).toEqual(['email', 'handoffCode', 'role', 'type']);
    expect(posted).toMatchObject({ type: 'signedUp', role: 'CLIENT', email });
    expect(typeof posted.handoffCode).toBe('string');
    expect(posted.handoffCode).toBe(body.handoffCode);
    await expect(page.getByText('Your account is ready.')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toMatch(/\/signup$/);

    // Native redemption: only the customer app's signature, once.
    // The request fixture inherits this describe's RenaApp UA, so the browser
    // call names a plain browser explicitly.
    const asBrowser = await request.post('/api/auth/native-handoff', {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1.15' },
      data: { code: posted.handoffCode },
    });
    expect(asBrowser.status()).toBe(400);
    const asApp = await request.post('/api/auth/native-handoff', {
      headers: { 'x-rena-shell': 'app-ios/1.0.1' },
      data: { code: posted.handoffCode },
    });
    expect(asApp.status()).toBe(200);
    const creds = (await asApp.json()) as Record<string, unknown>;
    expect(typeof creds.token).toBe('string');
    expect(typeof creds.bridgeCode).toBe('string');
    const replay = await request.post('/api/auth/native-handoff', {
      headers: { 'x-rena-shell': 'app-ios/1.0.1' },
      data: { code: posted.handoffCode },
    });
    expect(replay.status()).toBe(400);
  });
});

test('website signup: no handoff code and no native credential in the response', async ({
  page,
}) => {
  const email = `e2e-b5-web-${Date.now()}@integration.invalid`;
  const signupBody = page.waitForResponse((r) => r.url().endsWith('/api/auth/signup'));
  await page.goto('/signup');
  await page.getByRole('button', { name: /I need a cleaner/i }).click();
  await fillSignup(page, email);
  await page.locator('form button[type="submit"]').click();
  const body = (await (await signupBody).json()) as Record<string, unknown>;
  expect(body.handoffCode).toBeUndefined();
  expect(body.token).toBeUndefined();
  expect(body.bridgeCode).toBeUndefined();
});
