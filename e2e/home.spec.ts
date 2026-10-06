import { test, expect } from '@playwright/test';

// Smoke checks on the public homepage as it really renders: a banner with
// the RENA wordmark and a menu button that opens the main navigation.
test.describe('Home Page', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Rena/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should open the main navigation from the menu button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'RENA' })).toBeVisible();
    await page.getByRole('button', { name: /open menu/i }).click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    expect(await nav.getByRole('link').count()).toBeGreaterThan(0);
  });

  test('should navigate to services page', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h1')).toBeVisible();
  });
});
