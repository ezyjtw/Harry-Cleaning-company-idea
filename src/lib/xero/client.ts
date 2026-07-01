import { XeroClient } from 'xero-node';

// A13-Xero: OAuth2 client factory. The integration is DORMANT until these env
// vars are set (xeroConfigured() === false ⇒ routes 503). Scopes:
//   accounting.settings    — read the chart of accounts (chunk a) + org settings
//   accounting.transactions — create bank transactions / invoices (chunk c, later)
//   offline_access          — refresh tokens (long-lived connection)
const SCOPES = ['accounting.settings', 'accounting.transactions', 'offline_access'];

export function xeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_REDIRECT_URI
  );
}

export function makeXeroClient(state?: string): XeroClient {
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID as string,
    clientSecret: process.env.XERO_CLIENT_SECRET as string,
    redirectUris: [process.env.XERO_REDIRECT_URI as string],
    scopes: SCOPES,
    ...(state ? { state } : {}),
  });
}
