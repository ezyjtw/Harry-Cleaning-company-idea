import { test, expect } from '@playwright/test';

// The public booking journey starts on /services (the service pages lead into
// /services/[category] and then /book/[id]); there is no /booking index page.
test.describe('Booking Flow', () => {
  test('should load the services page', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should show service type options', async ({ page }) => {
    await page.goto('/services');
    for (const name of ['Regular Cleaning', 'Deep Cleaning', 'End of Tenancy Cleaning']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('should open a service page with its own heading', async ({ page }) => {
    await page.goto('/services/regular');
    await expect(page.locator('h1')).toBeVisible();
  });
});
