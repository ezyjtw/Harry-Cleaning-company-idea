// RENA-005 (B6.1, James-ruled 2026-10-07): the Content Security Policy.
//
//   Step one (enforced, every response, from next.config.js): script-src
//   loses 'unsafe-eval' in production (development keeps it for React's dev
//   tooling); frame-ancestors 'none'; violations reported to /api/csp-report.
//   The strings live in csp-policy.js, which says why the enforced header is
//   not set here.
//   Step two (report only, authed pages only, per the ruling): a nonce and
//   'strict-dynamic' twin, so the nonce policy is observed before anything
//   enforces it. Enforcement (step three) waits for James's word.
//
//   Trust class is not rendering mode. The CSP class here is public/no-nonce
//   (the baselined public routes minus the auth pages, plus every
//   /cleaning/<area>) or signed-in/nonce. Whether a public/no-nonce page is
//   static, ISR or per request is B6.3's separate concern (render-modes.ts):
//   /, /cleaners and /cleaning/<area> are public/no-nonce yet render per
//   request. A nonce would force per-request rendering, which is why public
//   pages carry none.
import list from '../../../docs/public-routes.json';

import policy from './csp-policy';

export const CSP_REPORT_PATH: string = policy.CSP_REPORT_PATH;
export const CSP_REPORT_GROUP: string = policy.CSP_REPORT_GROUP;

const AUTH_PAGES = new Set(['/login', '/signup', '/forgot-password']);
const PUBLIC_NO_NONCE = new Set(list.routes.filter((r) => !AUTH_PAGES.has(r)));

/** CSP trust class public/no-nonce (independent of the page's rendering mode). */
export function isPublicNoNoncePath(pathWithoutLocale: string): boolean {
  // Every /cleaning/<area> page is the baselined /cleaning/chingford template.
  return PUBLIC_NO_NONCE.has(pathWithoutLocale) || pathWithoutLocale.startsWith('/cleaning/');
}

/** The enforced policy (step one), served as a next.config header. */
export const enforcedPolicy = (production: boolean): string => policy.enforcedPolicy(production);

/** The report-only nonce twin (step two), authed pages only. */
export const reportOnlyPolicy = (nonce: string): string => policy.reportOnlyPolicy(nonce);

/** A fresh nonce: 16 random bytes, base64 (Edge-safe Web Crypto). */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...Array.from(bytes)));
}
