import { test, expect } from '@playwright/test';

// RENA-005 (B6.1): the enforced step one header on the served pages, and no
// ENFORCED CSP violation while they load and run. Report-only (step two)
// violations are observations, not failures: they are counted and attached.
const PAGES = ['/', '/services/regular', '/cleaners', '/login', '/pricing'];

for (const path of PAGES) {
  test(`${path}: step one header, zero enforced CSP violations`, async ({ page }, info) => {
    const seen: Array<{ disposition: string; directive: string; blocked: string }> = [];
    await page.exposeFunction('__cspSeen', (v: (typeof seen)[number]) => seen.push(v));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { __cspSeen: (v: unknown) => void }).__cspSeen({
          disposition: e.disposition,
          directive: e.violatedDirective,
          blocked: e.blockedURI,
        })
      );
    });
    const res = await page.goto(path);
    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('report-uri /api/csp-report');
    await page.waitForLoadState('networkidle');
    const reported = seen.filter((v) => v.disposition === 'report');
    await info.attach('report-only violations', { body: JSON.stringify(reported, null, 2) });
    expect(seen.filter((v) => v.disposition === 'enforce')).toEqual([]);
  });
}

// Step two: an authed-class page's own scripts carry the report-only nonce,
// so the twin reports only what the nonce policy would really block.
test('/login: every script carries the report-only nonce; no report-only violation', async ({
  page,
  request,
}) => {
  const res = await request.get('/login');
  const ro = res.headers()['content-security-policy-report-only'] ?? '';
  const nonce = /'nonce-([^']+)'/.exec(ro)?.[1];
  expect(nonce).toBeTruthy();
  const html = await res.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  const executable = scripts.filter((s) => !/type="application\/ld\+json"/.test(s));
  expect(executable.length).toBeGreaterThan(0);
  for (const s of executable) expect(s).toContain(`nonce="${nonce}"`);

  const reported: string[] = [];
  await page.exposeFunction('__cspReport', (v: string) => reported.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __cspReport: (v: string) => void }).__cspReport(
        `${e.disposition} ${e.violatedDirective} ${e.blockedURI}`
      )
    );
  });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  expect(reported).toEqual([]);
});
