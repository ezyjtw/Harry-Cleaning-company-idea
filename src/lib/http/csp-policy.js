// RENA-005 (B6.1): the policy strings, plain CommonJS so next.config.js (which
// cannot import TypeScript) and the middleware (through csp.ts) share them.
//
// Why the enforced policy is a next.config header and not a middleware one:
// Next 14 copies every middleware response header onto the request it
// renders (router-utils/resolve-routes), and the render takes its script
// nonce from the request's Content-Security-Policy before its Report-Only
// header. A nonce-less enforced header set by the middleware therefore hid
// the step two nonce (benched: no script carried it). Config headers reach
// the response only.

const CSP_REPORT_PATH = '/api/csp-report';
const CSP_REPORT_GROUP = 'csp-endpoint';

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
function enforcedPolicy(production) {
  const script = production
    ? "script-src 'self' 'unsafe-inline' https://js.stripe.com"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com";
  return ["default-src 'self'", script, ...SHARED].join('; ');
}

/** The report-only nonce twin (step two), authed pages only. */
function reportOnlyPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    ...SHARED,
  ].join('; ');
}

module.exports = { CSP_REPORT_PATH, CSP_REPORT_GROUP, enforcedPolicy, reportOnlyPolicy };
