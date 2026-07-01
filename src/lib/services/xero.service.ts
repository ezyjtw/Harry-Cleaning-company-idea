import type { TokenSet } from 'openid-client';
import type { XeroClient } from 'xero-node';

import { prisma } from '@/lib/db/prisma';
import { makeXeroClient, xeroConfigured } from '@/lib/xero/client';
import { decryptToken, encryptToken, generateKeyId } from '@/lib/xero/token-crypto';

// A13-Xero: manage the single connection to James's Xero org. Tokens are stored
// ENCRYPTED (see token-crypto). This chunk (a) only CONNECTS and READS — no writes
// to Xero (pushes are chunk c). The integration is dormant until env is configured
// and an admin completes the OAuth connect.

const KEY = 'primary';

export interface XeroStatus {
  configured: boolean; // env creds present
  connected: boolean; // an OAuth connection exists
  tenantName: string | null;
  expiresAt: string | null;
}

export interface XeroAccount {
  code: string;
  name: string;
  type: string;
  taxType: string;
  status: string;
}

function tokenExpiryDate(tokenSet: TokenSet): Date {
  if (tokenSet.expires_at) return new Date(tokenSet.expires_at * 1000);
  return new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000);
}

export async function getConnection() {
  return prisma.xeroConnection.findUnique({ where: { key: KEY } });
}

export async function getStatus(): Promise<XeroStatus> {
  const conn = await getConnection();
  return {
    configured: xeroConfigured(),
    connected: !!conn,
    tenantName: conn?.tenantName ?? null,
    expiresAt: conn?.expiresAt.toISOString() ?? null,
  };
}

/** Persist a fresh token set + org, encrypting the tokens. Upsert = singleton. */
export async function saveConnection(
  tokenSet: TokenSet,
  tenant: { tenantId: string; tenantName?: string },
  userId: string | null
) {
  if (!tokenSet.access_token || !tokenSet.refresh_token) {
    throw new Error('Xero token set missing access/refresh token');
  }
  const keyId = generateKeyId();
  const data = {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName ?? null,
    accessTokenEnc: encryptToken(tokenSet.access_token, keyId),
    refreshTokenEnc: encryptToken(tokenSet.refresh_token, keyId),
    expiresAt: tokenExpiryDate(tokenSet),
    keyId,
    connectedByUserId: userId,
  };
  await prisma.xeroConnection.upsert({
    where: { key: KEY },
    create: { key: KEY, ...data },
    update: data,
  });
}

export async function disconnect() {
  await prisma.xeroConnection.deleteMany({ where: { key: KEY } });
}

/**
 * Return a Xero client with a VALID access token (refreshed + rotated if it is
 * within 2 minutes of expiry), plus the tenant id. Null if not configured/connected.
 */
export async function getAuthedClient(): Promise<{ client: XeroClient; tenantId: string } | null> {
  if (!xeroConfigured()) return null;
  const conn = await getConnection();
  if (!conn) return null;

  const client = makeXeroClient();
  const refreshToken = decryptToken(conn.refreshTokenEnc, conn.keyId);

  if (conn.expiresAt.getTime() - Date.now() < 120_000) {
    // Refresh + rotate + re-store (encrypted with a fresh keyId).
    const newSet = await client.refreshWithRefreshToken(
      process.env.XERO_CLIENT_ID as string,
      process.env.XERO_CLIENT_SECRET as string,
      refreshToken
    );
    if (!newSet.access_token || !newSet.refresh_token) {
      throw new Error('Xero refresh returned no tokens');
    }
    const keyId = generateKeyId();
    await prisma.xeroConnection.update({
      where: { key: KEY },
      data: {
        accessTokenEnc: encryptToken(newSet.access_token, keyId),
        refreshTokenEnc: encryptToken(newSet.refresh_token, keyId),
        expiresAt: tokenExpiryDate(newSet),
        keyId,
      },
    });
    client.setTokenSet(newSet);
  } else {
    client.setTokenSet({
      access_token: decryptToken(conn.accessTokenEnc, conn.keyId),
      refresh_token: refreshToken,
      expires_at: Math.floor(conn.expiresAt.getTime() / 1000),
      token_type: 'Bearer',
    });
  }

  return { client, tenantId: conn.tenantId };
}

/** Read James's existing chart of accounts (read-only) for the mapping UI (chunk b). */
export async function getChartOfAccounts(): Promise<XeroAccount[] | null> {
  const authed = await getAuthedClient();
  if (!authed) return null;
  const res = await authed.client.accountingApi.getAccounts(authed.tenantId);
  return (res.body.accounts ?? []).map((a) => ({
    code: a.code ?? '',
    name: a.name ?? '',
    type: a.type ? String(a.type) : '',
    taxType: a.taxType ?? '',
    status: a.status ? String(a.status) : '',
  }));
}
