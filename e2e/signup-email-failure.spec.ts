import { test, expect } from '@playwright/test';

// RENA-077 (James-ruled): when the verification email cannot be sent the
// account is still created and the person is told plainly, with a retry.
// CI has no email provider configured and the rig's provider rejects sends,
// so in both the send fails for real here.
test('signup with a failed verification email says so and offers a retry', async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@integration.invalid`;
  await page.goto('/signup');
  await page.getByRole('button', { name: /I need a cleaner/i }).click();
  await page.fill('#firstName', 'Test');
  await page.fill('#lastName', 'Person');
  await page.fill('input[type="email"]', email);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill('Str0ng!Passw0rd-2026');
  if ((await pw.count()) > 1) await pw.nth(1).fill('Str0ng!Passw0rd-2026');
  const terms = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await terms.count()); i += 1) await terms.nth(i).check();
  await page.locator('form button[type="submit"]').click();

  const notice = page.getByTestId('signup-email-notice');
  await expect(notice).toContainText(
    "Account created, but we couldn't send the verification email.",
    { timeout: 20000 }
  );
  await expect(notice).not.toContainText(/check your email/i);

  await page.getByTestId('signup-email-retry').click();
  await expect(notice).toContainText("We still couldn't send it", { timeout: 15000 });

  await page.getByTestId('signup-email-continue').click();
  await expect(page).toHaveURL(/\/account/);
});
