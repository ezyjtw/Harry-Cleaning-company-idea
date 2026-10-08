import { createHash, randomBytes } from 'crypto';

import type { NativeHandoffApp, Role } from '@prisma/client';

import prisma from '@/lib/db/prisma';
import { log } from '@/lib/log';

import { sessionLabel } from './device-session';
import { generateApiToken, generateBridgeCode } from './session';

export { shellHandoffApp } from '@/lib/shell';

// RENA-031/082 (B5, James-ruled 2026-10-07): the signup and join handoff.
//
// Law: no long-lived native credential ever exists in page JS, WebView
// storage, URLs or postMessage. The page receives only this code (plus
// non-secret display data) and posts it to the shell; the shell redeems it by
// native fetch, and only that response carries the Bearer and the bridge code,
// which go straight into SecureStore. The code is short-lived, single-use and
// bound to the user, the role and the app it was minted for. x-rena-shell
// chooses who is offered a code; it is never authentication: the code is.

export const HANDOFF_TTL_S = 120;

/** The role each app's handoff may carry. */
const APP_ROLE: Record<NativeHandoffApp, Role> = { PRO: 'CLEANER', CUSTOMER: 'CLIENT' };

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Mint a handoff code for a just-created account. Only the hash is stored. */
export async function mintNativeHandoffCode(
  input: { userId: string; role: Role; app: NativeHandoffApp },
  now: Date = new Date()
): Promise<string> {
  if (APP_ROLE[input.app] !== input.role) {
    throw new Error('mintNativeHandoffCode: role does not belong to this app');
  }
  const code = randomBytes(32).toString('base64url');
  await prisma.nativeHandoffCode.create({
    data: {
      codeHash: hashCode(code),
      userId: input.userId,
      role: input.role,
      app: input.app,
      expiresAt: new Date(now.getTime() + HANDOFF_TTL_S * 1000),
    },
  });
  log.info('native_handoff', 'minted', { userId: input.userId, app: input.app });
  return code;
}

export type HandoffRedemption =
  | { ok: true; token: string; bridgeCode: string; userId: string }
  | { ok: false; reason: 'malformed' | 'unknown' | 'spent_or_expired' | 'account' | 'role' };

/**
 * Redeem a handoff code for the app presenting it. The claim is one
 * compare-and-set (usedAt null, unexpired, same app): two concurrent
 * redemptions of one code give one winner, and a code is consumed even when a
 * later check refuses it (fail closed). The account must still be ACTIVE,
 * unsuspended, not deleted, and hold the role the code was minted for.
 */
export async function redeemNativeHandoffCode(
  code: unknown,
  app: NativeHandoffApp,
  options: { label?: string | null } = {},
  now: Date = new Date()
): Promise<HandoffRedemption> {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    // B5 UAT ruling: every refusal logs once; the code itself never does.
    log.warn('native_handoff', 'refused', { app, reason: 'malformed' });
    return { ok: false, reason: 'malformed' };
  }
  const codeHash = hashCode(code);
  const claimed = await prisma.nativeHandoffCode.updateMany({
    where: { codeHash, app, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) {
    const exists = await prisma.nativeHandoffCode.findUnique({
      where: { codeHash },
      select: { id: true },
    });
    const reason = exists ? 'spent_or_expired' : 'unknown';
    log.warn('native_handoff', 'refused', { app, reason });
    return { ok: false, reason };
  }
  const row = await prisma.nativeHandoffCode.findUniqueOrThrow({
    where: { codeHash },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
          isSuspended: true,
          isDeleted: true,
        },
      },
    },
  });
  const u = row.user;
  if (u.accountStatus !== 'ACTIVE' || u.isSuspended || u.isDeleted) {
    log.warn('native_handoff', 'refused', { app, reason: 'account', userId: u.id });
    return { ok: false, reason: 'account' };
  }
  if (u.role !== row.role || APP_ROLE[app] !== row.role) {
    log.warn('native_handoff', 'refused', { app, reason: 'role', userId: u.id });
    return { ok: false, reason: 'role' };
  }
  const { token, jti } = await generateApiToken(
    { id: u.id, email: u.email, name: u.name || '', role: u.role },
    { label: sessionLabel(options.label, 'native') }
  );
  log.info('native_handoff', 'redeemed', { app, userId: u.id });
  return {
    ok: true,
    token,
    bridgeCode: generateBridgeCode({ id: u.id, bearerJti: jti }),
    userId: u.id,
  };
}
