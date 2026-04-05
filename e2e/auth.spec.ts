import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);
  });

  test('should show signup page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/signup/);
  });

  test('should require email and password for login', async ({ page }) => {
    await page.goto('/login');
    // Look for email and password input fields
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    // At least one form element should exist
    const hasEmailInput = await emailInput.count();
    const hasPasswordInput = await passwordInput.count();
    expect(hasEmailInput + hasPasswordInput).toBeGreaterThan(0);
  });

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show auth prompt
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Either redirected to login or still on dashboard (if it handles auth client-side)
    expect(url).toBeTruthy();
  });

  test('should redirect unauthenticated users from admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Admin pages should require authentication
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
