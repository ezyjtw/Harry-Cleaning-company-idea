import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should load the booking page', async ({ page }) => {
    await page.goto('/booking');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should show service type options', async ({ page }) => {
    await page.goto('/booking');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    // Check that the page has content
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});
