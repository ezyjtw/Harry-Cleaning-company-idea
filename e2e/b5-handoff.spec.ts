import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// B5 (RENA-082, James-ruled): the in-shell customer signup hands the new
// account to the native shell with a single-use code only. A stubbed
// window.ReactNativeWebView collects what the page posts. The website path is
// unchanged and its signup response carries no native credential at all.
const PASSWORD = 'Str0ng!Passw0rd-2026';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
// Customer-4 advertises signedUpHandoffV1 (James-ruled 8 Oct); every shell
// installed before it carries the bridge but not the token.
const CUSTOMER_4_UA = `${IPHONE} RenaApp/1.0.2 RenaCap/signedUpHandoffV1`;
const CUSTOMER_LEGACY_UA = `${IPHONE} RenaApp/1.0.1`;
// Signup allows 3 an hour per address; each test signs up from its own.
const freshIp = () =>
  `198.51.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;

async function stubBridge(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __posted: string[];
      ReactNativeWebView: { postMessage(m: string): void };
    };
    w.__posted = [];
    w.ReactNativeWebView = { postMessage: (m: string) => w.__posted.push(m) };
  });
}
/**
 * The normal website outcome of a created account: signed in on the web, then
 * either the role home or, when the verification email could not go, the
 * honest notice (RENA-077) with its own door to the account.
 */
async function websiteOutcome(page: Page, email: string, timeout: number) {
  await expect
    .poll(
      async () =>
        /\/account/.test(new URL(page.url()).pathname) ||
        (await page.getByText("we couldn't send the verification email").count()) > 0,
      { timeout }
    )
    .toBe(true);
  const session = (await (await page.request.get('/api/auth/session')).json()) as {
    user?: { email?: string };
  };
  expect(session.user?.email).toBe(email);
}
const postedCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __posted: string[] }).__posted.length);

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

test.describe('customer shell signup handoff, capable shell (Customer-4)', () => {
  test.use({ userAgent: CUSTOMER_4_UA, extraHTTPHeaders: { 'x-forwarded-for': freshIp() } });

  test('posts one signedUp message with a handoff code, no premature fallback; the code redeems natively once', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    await stubBridge(page);
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
    // No premature fallback: the page waits on the shell for the full net.
    await page.waitForTimeout(8500);
    expect(new URL(page.url()).pathname).toMatch(/\/signup$/);
    await expect(page.getByText('Signing you in')).toBeVisible();
    expect(await postedCount(page)).toBe(1);

    // Native redemption: only the customer app's signature, once.
    // The request fixture inherits this describe's RenaApp UA, so the browser
    // call names a plain browser explicitly, carrying the capability token: the
    // token is never a shell signature.
    const asBrowser = await request.post('/api/auth/native-handoff', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1.15 RenaCap/signedUpHandoffV1',
      },
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

  test('safety net: still "Signing you in" after 10 seconds, the page finishes on the website path', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await stubBridge(page);
    const email = `e2e-b5-net-${Date.now()}@integration.invalid`;
    await page.goto('/signup');
    await fillSignup(page, email);
    const submittedAt = Date.now();
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText('Signing you in')).toBeVisible();
    await websiteOutcome(page, email, 25_000);
    const waited = Date.now() - submittedAt;
    expect(waited).toBeGreaterThanOrEqual(10_000);
    expect(await postedCount(page)).toBe(1);
  });
});

test.describe('customer shell signup, legacy shell (bridge, no capability)', () => {
  test.use({ userAgent: CUSTOMER_LEGACY_UA, extraHTTPHeaders: { 'x-forwarded-for': freshIp() } });

  test('never shows "Signing you in", never posts, completes to the website outcome', async ({
    page,
  }) => {
    await stubBridge(page);
    const email = `e2e-b5-legacy-${Date.now()}@integration.invalid`;
    let sawSigningIn = false;
    await page.goto('/signup');
    await fillSignup(page, email);
    const submittedAt = Date.now();
    const watch = page
      .getByText('Signing you in')
      .waitFor({ timeout: 6000 })
      .then(() => (sawSigningIn = true))
      .catch(() => {});
    await page.locator('form button[type="submit"]').click();
    await websiteOutcome(page, email, 9_000);
    expect(Date.now() - submittedAt).toBeLessThan(9_000);
    await watch;
    expect(sawSigningIn).toBe(false);
    expect(await postedCount(page)).toBe(0);
  });
});

test.describe('spoofed capability in a plain browser', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (Macintosh) Safari/605.1.15 RenaCap/signedUpHandoffV1',
    extraHTTPHeaders: { 'x-forwarded-for': freshIp() },
  });

  test('changes nothing server side: no handoff code, no native credential, website path', async ({
    page,
  }) => {
    await stubBridge(page);
    const email = `e2e-b5-spoof-${Date.now()}@integration.invalid`;
    const signupBody = page.waitForResponse((r) => r.url().endsWith('/api/auth/signup'));
    await page.goto('/signup');
    await page.getByRole('button', { name: /I need a cleaner/i }).click();
    await fillSignup(page, email);
    await page.locator('form button[type="submit"]').click();
    const body = (await (await signupBody).json()) as Record<string, unknown>;
    expect(body.handoffCode).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(body.bridgeCode).toBeUndefined();
    await websiteOutcome(page, email, 9_000);
    expect(await postedCount(page)).toBe(0);
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
