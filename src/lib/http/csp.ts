// RENA-005 (B6.1, James-ruled 2026-10-07): the Content Security Policy.
//
//   Step one (enforced, every page): script-src loses 'unsafe-eval' in
//   production (development keeps it for React's dev tooling);
//   frame-ancestors 'none'; violations reported to /api/csp-report.
//   Step two (report only, authed pages only, per the ruling): a nonce and
//   'strict-dynamic' twin, so the nonce policy is observed before anything
//   enforces it. Public static pages carry no nonce, so they can stay static
//   (B6.3). Enforcement (step three) waits for James's word.
import list from '../../../docs/public-routes.json';

export const CSP_REPORT_PATH = '/api/csp-report';
export const CSP_REPORT_GROUP = 'csp-endpoint';

const AUTH_PAGES = new Set(['/login', '/signup', '/forgot-password']);
const PUBLIC_STATIC = new Set(list.routes.filter((r) => !AUTH_PAGES.has(r)));

/** A page served from the public static set (no nonce, may be cached). */
export function isPublicStaticPath(pathWithoutLocale: string): boolean {
  // Every /cleaning/<area> page is the baselined /cleaning/chingford template.
  return PUBLIC_STATIC.has(pathWithoutLocale) || pathWithoutLocale.startsWith('/cleaning/');
}

const SHARED = [
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.sentry.io https://api.postcodes.io",
  'frame-src https://js.stripe.com https://hooks.stripe.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_GROUP}`,
];

/** The enforced policy (step one). */
export function enforcedPolicy(production: boolean): string {
  const script = production
    ? "script-src 'self' 'unsafe-inline' https://js.stripe.com"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com";
  return ["default-src 'self'", script, ...SHARED].join('; ');
}

/** The report-only nonce twin (step two), authed pages only. */
export function reportOnlyPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    ...SHARED,
  ].join('; ');
}

/** A fresh nonce: 16 random bytes, base64 (Edge-safe Web Crypto). */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}
