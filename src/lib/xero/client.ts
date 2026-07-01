import { XeroClient } from 'xero-node';

// A13-Xero: OAuth2 client factory. The integration is DORMANT until these env
// vars are set (xeroConfigured() === false ⇒ routes 503). Scopes:
//   openid profile email        — REQUIRED base OpenID scopes; Xero rejects the
//                                 consent request with `invalid_scope` without them.
//   accounting.settings         — read the chart of accounts (chunk a) + settings.
//   accounting.banktransactions — create BANK TRANSACTIONS (chunk c, gross+clearing:
//                                 gross→clearing, fee→income, payout-from-clearing,
//                                 and refunds as reversing bank transactions).
//   offline_access              — refresh tokens (long-lived connection).
// NOTE: Xero's transaction scopes are granular (accounting.banktransactions,
// accounting.invoices, accounting.payments, …) — there is NO `accounting.transactions`
// scope, so requesting it returns invalid_scope. Our model uses only bank
// transactions, so accounting.banktransactions is sufficient.
// Passed to Xero space-separated (xero-node does scopes.join(' ')).
export const SCOPES = [
  'openid',
  'profile',
  'email',
  'accounting.settings',
  'accounting.banktransactions',
  'offline_access',
];

export function xeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_REDIRECT_URI
  );
}

// `scopesOverride` is a DIAGNOSTIC hook (admin-only connect route) to isolate
// which scope Xero rejects with invalid_scope. Normal calls use the default SCOPES.
export function makeXeroClient(state?: string, scopesOverride?: string[]): XeroClient {
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID as string,
    clientSecret: process.env.XERO_CLIENT_SECRET as string,
    redirectUris: [process.env.XERO_REDIRECT_URI as string],
    scopes: scopesOverride && scopesOverride.length > 0 ? scopesOverride : SCOPES,
    ...(state ? { state } : {}),
  });
}
