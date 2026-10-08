import { expect, test } from '@playwright/test';

// B5 (RENA-043): the /get-app doors with no listing configured (CI and the
// rig set none): every platform gets the honest page, an unknown app is a 404.
for (const [path, name] of [
  ['/get-app/pro', 'Rena Pro'],
  ['/get-app/customer', 'RENA'],
] as const) {
  test(`${path} renders the coming-soon page when no listing is configured`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Get ${name}`);
    await expect(page.getByText(/is on its way to the App Store and Google Play/)).toBeVisible();
  });
}

test('an unknown app is not found', async ({ request }) => {
  const res = await request.get('/get-app/admin', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
