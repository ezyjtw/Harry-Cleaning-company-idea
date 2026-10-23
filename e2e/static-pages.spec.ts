import { test, expect } from '@playwright/test';

// RENA-051 (B6.3): a page prerendered at build renders what the per-request
// page did. Regression: the static /contact prerender saw /en/contact and
// baked in the contact button that the page itself never shows.
test('/contact serves no contact button, statically or after hydration', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/contact')).text();
  expect(html).not.toContain('aria-label="Contact us"');
  await page.goto('/contact');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('link', { name: 'Contact us' })).toHaveCount(0);
});
