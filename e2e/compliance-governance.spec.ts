import { expect, test } from '@playwright/test';

import { hasFixtures, isolateRateBucket, signIn } from './fixtures';

// B7.8 (RENA-072): the admin compliance page renders the DPA, breach and ICO
// sections the API serves, and report_breach creates a row. Synthetic admin
// fixture; the breach title carries an internal reference only.
test.describe('compliance governance sections (B7.8)', () => {
  test.skip(!hasFixtures, 'needs the fixture database');

  test('the three sections render and a breach can be reported', async ({ page }) => {
    await isolateRateBucket(page);
    await signIn(page, 'admin');
    await page.goto('/admin/compliance');
    await expect(page.getByTestId('dpa-section')).toBeVisible();
    await expect(page.getByTestId('breach-section')).toBeVisible();
    await expect(page.getByTestId('ico-section')).toBeVisible();

    const ref = `E2E-BREACH-${Date.now()}`;
    const breach = page.getByTestId('breach-section');
    await breach.getByLabel('Title (no personal data)').fill(ref);
    await breach.getByLabel(/Description/).fill('e2e synthetic incident, zero rows affected');
    await breach.getByRole('button', { name: 'Report breach' }).click();
    await expect(breach.getByText(ref)).toBeVisible({ timeout: 15000 });
    await expect(breach.getByText('DETECTED').first()).toBeVisible();
  });
});
