import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { FIXTURES, fixtureCleanerId, hasFixtures, isolateRateBucket, signIn } from './fixtures';

// B2b: honest states (RENA-019, 053), the field error sweep (RENA-054),
// RENA-084 mechanism 3, Pro Today's 15 s window, the wizard's sign-in round
// trip (RENA-020) and the viewport fix (RENA-098).

test.beforeEach(async ({ page }) => {
  await isolateRateBucket(page);
});

const BASE = 'http://localhost:3000';
const customerPreview = (page: Page) =>
  page.context().addCookies([{ name: 'rena-customer-preview', value: '1', url: BASE }]);
const proPreview = (page: Page) =>
  page.context().addCookies([{ name: 'rena-app-preview', value: '1', url: BASE }]);

// ─── RENA-019: Home and Book state separation (amendment 1) ────────────────
test.describe('customer app panes: honest states', () => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

  const answer = (status: number) => (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: '{"error":"x"}' });

  for (const [label, handler, kind] of [
    ['a 403 is an access error', answer(403), 'forbidden'],
    ['a 500 is a retryable error', answer(500), 'error'],
    ['a 429 is a retryable error', answer(429), 'error'],
    ['a network failure is offline', (r: Route) => r.abort('internetdisconnected'), 'offline'],
  ] as const) {
    test(`Home: ${label}, never No Cleans`, async ({ page }) => {
      await signIn(page, 'customerA');
      await customerPreview(page);
      await page.route('**/api/bookings?pageSize=50', handler);
      await page.goto('/app/home');
      const card = page.getByTestId('home-failure');
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-kind', kind);
      await expect(page.getByText('No Cleans Booked')).toHaveCount(0);
      // The session is never touched by anything but a 401.
      expect(page.url()).toContain('/app/home');
    });
  }

  test('Home: a 401 runs the belt to /login with a way back', async ({ page }) => {
    await signIn(page, 'customerA');
    await customerPreview(page);
    await page.route('**/api/bookings?pageSize=50', answer(401));
    await page.goto('/app/home');
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fapp%2Fhome/, { timeout: 15000 });
  });

  test('Home: only a successful empty answer renders No Cleans; Try again recovers', async ({
    page,
  }) => {
    await signIn(page, 'customerA');
    await customerPreview(page);
    await page.route('**/api/bookings?pageSize=50', answer(500));
    await page.goto('/app/home');
    await expect(page.getByTestId('home-failure')).toBeVisible();
    await page.unroute('**/api/bookings?pageSize=50');
    await page.route('**/api/bookings?pageSize=50', (r) =>
      r.fulfill({ contentType: 'application/json', body: '{"data":[]}' })
    );
    await page.getByTestId('pane-failure-retry').click();
    await expect(page.getByText('No Cleans Booked')).toBeVisible();
    await expect(page.getByTestId('home-failure')).toHaveCount(0);
  });

  test('Book: a failure is its own card and the service rows stay', async ({ page }) => {
    await signIn(page, 'customerA');
    await customerPreview(page);
    await page.route('**/api/bookings?status=COMPLETED*', answer(500));
    await page.goto('/app/book');
    await expect(page.getByTestId('book-failure')).toHaveAttribute('data-kind', 'error');
    await expect(page.getByTestId('service-rows')).toBeVisible();
  });
});

// ─── RENA-053: the directory's error versus empty ──────────────────────────
test('directory: a failed search says so with Retry, and Retry restores the list', async ({
  page,
}) => {
  test.skip(!hasFixtures, 'needs the fixture cleaner');
  await page.route('**/api/cleaners?*', (r) => r.fulfill({ status: 500, body: '{}' }));
  await page.goto('/cleaners?postcode=E4%209AA');
  await expect(page.getByTestId('cleaners-load-error')).toBeVisible();
  await expect(page.getByText('No cleaners found matching your criteria.')).toHaveCount(0);
  await page.unroute('**/api/cleaners?*');
  await page.getByTestId('cleaners-retry').click();
  await expect(page.getByText('Cleo Fixture').first()).toBeVisible();
});

test('directory: zero results keep their own copy', async ({ page }) => {
  await page.route('**/api/cleaners?*', (r) =>
    r.fulfill({ contentType: 'application/json', body: '{"cleaners":[],"count":0}' })
  );
  await page.goto('/cleaners?postcode=E4%209AA');
  await expect(page.getByText('No cleaners found matching your criteria.')).toBeVisible();
  await expect(page.getByTestId('cleaners-load-error')).toHaveCount(0);
});

// ─── RENA-054: field errors through their fields; axe ──────────────────────
test('contact: field errors are described by their fields, not alerts, and focus the first', async ({
  page,
}) => {
  await page.goto('/contact');
  await page.locator('form button[type="submit"]').click();
  const name = page.locator('#name');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAttribute('aria-describedby', 'name-error');
  await expect(page.locator('#name-error')).toBeVisible();
  await expect(page.locator('#name-error')).not.toHaveAttribute('role', 'alert');
  await expect(name).toBeFocused();
  await page.fill('#name', 'Fixture Person');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
});

test('contact: error-free markup carries no error attributes', async ({ page }) => {
  await page.goto('/contact');
  for (const id of ['name', 'email', 'message']) {
    await expect(page.locator(`#${id}`)).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(page.locator(`#${id}`)).not.toHaveAttribute('aria-invalid', /.+/);
  }
});

// The rules this sweep owns: names, labels and every aria reference valid.
const FORM_RULES = [
  'aria-valid-attr',
  'aria-valid-attr-value',
  'aria-allowed-attr',
  'aria-required-attr',
  'duplicate-id-aria',
  'button-name',
  'link-name',
];

for (const path of ['/join', '/login', '/signup', '/services/regular', '/contact']) {
  test(`axe: ${path} has no form accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page }).withRules(FORM_RULES).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test('axe: /contact with every field in error stays valid', async ({ page }) => {
  await page.goto('/contact');
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('#message-error')).toBeVisible();
  const result = await new AxeBuilder({ page }).withRules(FORM_RULES).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

// ─── RENA-084 mechanism 3: dashboards refresh on a bfcache restore ─────────
test.describe('dashboards join the freshness contract', () => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

  test('/account refetches on a pageshow restore carrying a stale marker', async ({ page }) => {
    await signIn(page, 'customerA', '/account');
    await page.waitForLoadState('networkidle');
    let hits = 0;
    page.on('request', (r) => {
      if (/\/api\/bookings$/.test(new URL(r.url()).pathname + new URL(r.url()).search)) hits += 1;
    });
    // Chromium under automation does not reliably use the bfcache (honest
    // limit): the restore is dispatched synthetically, with the marker
    // Messages writes when a thread opens.
    await page.evaluate(() => {
      localStorage.setItem('rena:stale:account', String(Date.now()));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await expect.poll(() => hits).toBeGreaterThan(0);
  });

  test('opening a conversation marks the dashboards stale', async ({ page }) => {
    await signIn(page, 'customerA');
    const me = await page.evaluate(async () => {
      const r = await fetch('/api/auth/session');
      return ((await r.json()) as { user: { id: string } }).user.id;
    });
    await page.route('**/api/messages', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'e2e-partner',
              participants: [
                { id: me, name: 'You', avatar: '', role: 'customer' },
                { id: 'e2e-partner', name: 'Cleo Fixture', avatar: '', role: 'cleaner' },
              ],
              lastMessage: {
                id: 'm1',
                conversationId: 'e2e-partner',
                senderId: 'e2e-partner',
                content: 'See you Tuesday',
                read: false,
                createdAt: new Date().toISOString(),
              },
              unreadCount: 1,
              canSend: true,
              blockedByMe: false,
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      })
    );
    await page.route('**/api/messages/e2e-partner*', (r) =>
      r.fulfill({ contentType: 'application/json', body: '{"messages":[]}' })
    );
    await page.goto('/messages');
    await page.getByText('Cleo Fixture').first().click();
    const keys = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('rena:stale:'))
        .sort()
    );
    expect(keys).toEqual(['rena:stale:account', 'rena:stale:cleaner', 'rena:stale:home']);
  });
});

// ─── Pro Today: one 15 s window for both apps (amendment 2) ────────────────
test('Pro Today: on-show refetch coalesces at 15 s', async ({ page }) => {
  test.skip(!hasFixtures, 'needs the fixture cleaner');
  await signIn(page, 'cleaner');
  await proPreview(page);
  await page.clock.install();
  let hits = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cleaner/jobs?status=')) hits += 1;
  });
  await page.goto('/app/today');
  await page.waitForLoadState('networkidle');
  const base = hits;
  const show = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await show(); // first show after load: the window starts now
  await expect.poll(() => hits).toBe(base + 1);
  await page.clock.fastForward(10_000);
  await show(); // inside 15 s: coalesced
  await page.waitForTimeout(300);
  expect(hits).toBe(base + 1);
  await page.clock.fastForward(6_000);
  await show(); // 16 s after the last: refetches (it was 30 s before)
  await expect.poll(() => hits).toBe(base + 2);
});

// ─── RENA-020 (B2b): the wizard's answers ride the inline sign-in ──────────
test('wizard: a guest who signs in mid-flow returns to their answers', async ({ page }) => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
  await page.route('**/api/pricing/quote', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'area',
        serviceType: 'Regular Cleaning',
        isFixedPrice: false,
        cleanerCount: 1,
        minTotal: 63.6,
        maxTotal: 63.6,
        minCleanerPrice: 60,
        maxCleanerPrice: 60,
        minHourlyRate: 20,
      }),
    })
  );
  await page.goto('/services/regular?postcode=E4%209AA');
  await page.getByRole('button', { name: '3h', exact: true }).click();
  await page.fill('#guest-email-input', FIXTURES.customerA.email);
  await page.locator('#guest-email-input').blur();
  const notice = page.getByTestId('guest-email-account-notice');
  await expect(notice).toBeVisible();
  await notice.getByRole('link', { name: 'sign in' }).click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.fill('input[type="email"]', FIXTURES.customerA.email);
  await page.locator('input[type="password"]').first().fill('E2e-Fixture-Pass-2026!');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/services\/regular\?postcode=E4/, { timeout: 20000 });
  await expect(page.getByRole('button', { name: /^3h/ })).toContainText('✓');
  // One shot: a reload starts clean.
  const left = await page.evaluate(() => sessionStorage.getItem('rena-flow-signin'));
  expect(left).toBeNull();
});

// ─── RENA-098: the Book action is never under the bottom edge ──────────────
test.describe('phone width: the Book action stays reachable', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the profile sheet takes the dynamic viewport and its Book band is on screen', async ({
    page,
  }) => {
    test.skip(!hasFixtures, 'needs the fixture cleaner');
    await page.goto('/cleaners');
    await page.getByText('Cleo Fixture').first().click();
    const band = page
      .getByRole('link', { name: /Book now/ })
      .or(page.getByRole('button', { name: /Book/ }));
    await expect(band.first()).toBeVisible();
    const box = await band.first().boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
    const usesDvh = await page.evaluate(() =>
      Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some((r) => r.cssText.includes('100dvh'));
        } catch {
          return false;
        }
      })
    );
    expect(usesDvh).toBe(true);
  });

  test('on the profile page the contact button does not cover Book', async ({ page }) => {
    test.skip(!hasFixtures, 'needs the fixture cleaner');
    await page.goto(`/cleaners/${await fixtureCleanerId()}`);
    await expect(page.locator('a[aria-label="Contact us"]')).toBeHidden();
    const book = page.getByRole('link', { name: /Book now/ }).last();
    const box = await book.boundingBox();
    expect(box).not.toBeNull();
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.textContent ?? '',
      [(box?.x ?? 0) + (box?.width ?? 0) - 6, (box?.y ?? 0) + (box?.height ?? 0) / 2]
    );
    expect(hit).toMatch(/Book now/);
  });
});
