import { test, expect } from '@playwright/test';

// RENA-083 (B6.6): the self-hosted faces render. The computed family of a
// heading leads with the Newsreader subset family, a paragraph's with Jost's,
// and the browser reports the brand faces loaded (no system stand-in).
test('a heading renders in Newsreader and a paragraph in Jost', async ({ page }) => {
  await page.goto('/about');
  await page.evaluate(() => document.fonts.ready);
  const h1 = await page
    .locator('h1')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  const p = await page
    .locator('main p')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(h1).toMatch(/^['"]?__newsreaderLatin_/);
  expect(p).toMatch(/^['"]?__jostLatin_/);
  const loaded = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family)
  );
  expect(loaded.some((f) => /newsreaderLatin/.test(f))).toBe(true);
  expect(loaded.some((f) => /jostLatin/.test(f))).toBe(true);
});
