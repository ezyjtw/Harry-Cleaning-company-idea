import { expect, test } from '@playwright/test';

import { hasFixtures, isolateRateBucket, signIn } from './fixtures';

test.beforeEach(async ({ page }) => {
  await isolateRateBucket(page);
});

// RENA-023 (B2a): /pay/[id] never ends on a dead screen.
const PAY = '/pay/e2e-missing-booking';

test('signed out: the sign-in door, carrying the pay URL back', async ({ page }) => {
  await page.goto(PAY);
  const card = page.getByTestId('pay-failure');
  await expect(card).toHaveAttribute('data-kind', 'signin');
  await expect(page.getByTestId('pay-signin')).toHaveAttribute(
    'href',
    `/login?callbackUrl=${encodeURIComponent(PAY)}`
  );
  await expect(page.getByTestId('pay-home')).toBeVisible();
});

test('network failure offers Try again, and the retry reaches the server answer', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/bookings/*/pay-intent', async (route) => {
    calls += 1;
    if (calls === 1) return route.abort();
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'This clean is already paid.' }),
    });
  });
  await page.goto(PAY);
  await expect(page.getByTestId('pay-failure')).toHaveAttribute('data-kind', 'network');
  await page.getByTestId('pay-retry').click();
  await expect(page.getByTestId('pay-failure')).toHaveAttribute('data-kind', 'conflict');
  await expect(page.getByTestId('pay-failure')).toContainText('This clean is already paid.');
  await expect(page.getByTestId('pay-back')).toBeVisible();
});

test('a server error and a 403 each get their own state', async ({ page }) => {
  await page.route('**/api/bookings/*/pay-intent', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  );
  await page.goto(PAY);
  await expect(page.getByTestId('pay-failure')).toHaveAttribute('data-kind', 'server');
  await page.unroute('**/api/bookings/*/pay-intent');
  await page.route('**/api/bookings/*/pay-intent', (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
  );
  await page.reload();
  await expect(page.getByTestId('pay-failure')).toHaveAttribute('data-kind', 'forbidden');
  await expect(page.getByTestId('pay-retry')).toHaveCount(0);
});

test('signed in, a booking that is not theirs reads Not found with Back and Home', async ({
  page,
}) => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
  await signIn(page, 'customerA');
  await page.goto(PAY);
  await expect(page.getByTestId('pay-failure')).toHaveAttribute('data-kind', 'notfound');
  await expect(page.getByTestId('pay-back')).toBeVisible();
  await expect(page.getByTestId('pay-home')).toHaveAttribute('href', '/account');
});
