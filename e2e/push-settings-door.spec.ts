import { test, expect, type Page } from '@playwright/test';

import { hasFixtures, signIn } from './fixtures';

// B5.8 settings door (RENA-046, James-ruled 23 Oct): the notifications row on
// the customer Account Settings page and the Pro profile room shows only in
// a shell advertising pushSettingsV1, and a tap posts {type: 'pushSettings'}.
const SHELL_UA = (app: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ${app} RenaCap/signedUpHandoffV1`;

async function stubBridge(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __posted: string[]; ReactNativeWebView: unknown };
    w.__posted = [];
    w.ReactNativeWebView = { postMessage: (m: string) => w.__posted.push(m) };
  });
}
const posted = (page: Page) =>
  page.evaluate(() => (window as unknown as { __posted: string[] }).__posted);

test.describe('customer shell advertising the door', () => {
  test.use({ userAgent: `${SHELL_UA('RenaApp/1.0.1')},pushSettingsV1` });
  test('Account Settings shows Notifications; a tap posts pushSettings', async ({ page }) => {
    test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
    await stubBridge(page);
    await signIn(page, 'customerA');
    await page.goto('/account/settings');
    const door = page.getByTestId('push-settings-door');
    await expect(door).toBeVisible();
    await door.click();
    expect(await posted(page)).toContain(JSON.stringify({ type: 'pushSettings' }));
  });
});

test.describe('a shell without the token (every current binary and update)', () => {
  test.use({ userAgent: SHELL_UA('RenaApp/1.0.1') });
  test('Account Settings shows no door', async ({ page }) => {
    test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
    await stubBridge(page);
    await signIn(page, 'customerA');
    await page.goto('/account/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('push-settings-door')).toHaveCount(0);
  });
});

test('a browser sees no door on Account Settings', async ({ page }) => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
  await signIn(page, 'customerA');
  await page.goto('/account/settings');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('push-settings-door')).toHaveCount(0);
});

test.describe('Pro shell advertising the door', () => {
  test.use({ userAgent: `${SHELL_UA('RenaPro/1.0.3')},pushSettingsV1` });
  test('the profile room shows Notifications; a tap posts pushSettings', async ({ page }) => {
    test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');
    await stubBridge(page);
    await signIn(page, 'cleaner');
    await page.goto('/app/profile');
    const door = page.getByTestId('push-settings-door');
    await expect(door).toBeVisible();
    await door.click();
    expect(await posted(page)).toContain(JSON.stringify({ type: 'pushSettings' }));
  });
});
