import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Rena/i);
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate to services page', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h1')).toBeVisible();
  });
});
