import { expect, test } from '@playwright/test';

// RENA-020 (B2a, amendment 3): one sanitiser for login and signup. A hostile
// callbackUrl never survives into a navigation; the unit table is in
// src/lib/auth/callback-url.test.ts. Here: the login form's sign-up door and
// the pages themselves still render with a hostile value present.
for (const path of ['/login', '/signup']) {
  test(`${path} renders unchanged with a hostile callbackUrl`, async ({ page }) => {
    const res = await page.goto(`${path}?callbackUrl=${encodeURIComponent('//evil.example/x')}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${path}\\?callbackUrl=`));
    await expect(page.locator('form, [data-testid], main').first()).toBeVisible();
  });
}
