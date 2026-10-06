import { test, expect } from '@playwright/test';

// RENA-001 (B1b): GHSA-xmf8-cvqr-rfgj. next-auth below 4.24.15 let getToken()
// throw on a malformed Bearer Authorization header; the middleware calls
// getToken on every page request, so a junk header could turn a page into a
// 500. After the patch the page renders (or redirects to login) as normal.
const MALFORMED = [
  'Bearer',
  'Bearer ',
  'Bearer not.a.jwt',
  'Bearer %%%',
  'Bearer a.b',
  'Basic Zm9vOmJhcg==',
];

test.describe('malformed Authorization header (RENA-001)', () => {
  for (const header of MALFORMED) {
    test(`public page answers 200 with "${header}"`, async ({ request }) => {
      const res = await request.get('/', { headers: { authorization: header } });
      expect(res.status()).toBe(200);
    });

    test(`protected page redirects, never 500, with "${header}"`, async ({ request }) => {
      const res = await request.get('/account', {
        headers: { authorization: header },
        maxRedirects: 0,
      });
      expect(res.status()).toBeLessThan(500);
      expect([302, 303, 307, 308]).toContain(res.status());
    });
  }
});
