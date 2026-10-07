import { randomUUID } from 'crypto';

import type { DeviceSessionKind, Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';

// RENA-003, 007, 074 (D-g, B1a): the session rows. Kept apart from session.ts
// so the NextAuth callbacks (options.ts) can mint rows without a circular
// import (session.ts imports authOptions).
//
// Laws (James-ruled 2026-10-06):
//   Hierarchy    a bridged WEB session's expiry never exceeds its parent's;
//                revoking a BEARER revokes all its WEB children in the same
//                statement; parentJti is a revocation-group link only and is
//                never re-checked on a child's own request.
//   Grandfather  tokens minted before B1a carry no jti or sid. They are
//                accepted until LEGACY_TOKEN_CUTOFF with a missing sv read as
//                0 (so sign-out-everywhere and password change still reach
//                them through the version and pwdAt checks); after the cutoff
//                a missing jti or sid is invalid. The cutoff is a fixed,
//                documented constant: thirty days after the B1a deploy.

export const BEARER_TTL_S = 30 * 24 * 60 * 60;
export const WEB_TTL_S = 30 * 24 * 60 * 60;
export const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;
export const ROW_RETENTION_AFTER_END_MS = 30 * 24 * 60 * 60 * 1000;
export const LABEL_MAX = 60;

/**
 * Legacy-token cutoff (D-g grandfather). B1a's planned deploy is 2026-10-08;
 * the cutoff sits thirty days after it. If the deploy slips past that date
 * the constant moves with it in the gate, never silently.
 */
export const B1A_DEPLOY_DATE = '2026-10-08';
export const LEGACY_TOKEN_CUTOFF = new Date('2026-11-07T00:00:00.000Z');

export function legacyTokensAccepted(now: Date = new Date()): boolean {
  return now.getTime() < LEGACY_TOKEN_CUTOFF.getTime();
}

/** A short, non-personal session label (the x-rena-shell value, or 'web'). */
export function sessionLabel(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  return (v ? v : fallback).slice(0, LABEL_MAX);
}

export type RevokeReason = 'logout' | 'switch' | 'all' | 'password' | 'admin' | 'deletion';

type Db = Prisma.TransactionClient | typeof prisma;

export interface MintedRow {
  jti: string;
  sv: number;
  expiresAt: Date;
}

/** Insert one session row. `sv` is the user's sessionVersion at mint. */
export async function mintDeviceSession(
  input: {
    userId: string;
    kind: DeviceSessionKind;
    label: string;
    sv: number;
    expiresAt: Date;
    parentJti?: string | null;
    jti?: string;
  },
  db: Db = prisma
): Promise<MintedRow> {
  const jti = input.jti ?? randomUUID();
  await db.deviceSession.create({
    data: {
      jti,
      userId: input.userId,
      kind: input.kind,
      label: input.label,
      sv: input.sv,
      expiresAt: input.expiresAt,
      parentJti: input.parentJti ?? null,
    },
  });
  return { jti, sv: input.sv, expiresAt: input.expiresAt };
}

/** A WEB row for a website sign-in (NextAuth credentials). */
export async function createWebSessionRow(
  input: { userId: string; label: string; now?: Date },
  db: Db = prisma
): Promise<MintedRow> {
  const now = input.now ?? new Date();
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { sessionVersion: true },
  });
  if (!user) throw new Error('session row: user not found');
  return mintDeviceSession(
    {
      userId: input.userId,
      kind: 'WEB',
      label: sessionLabel(input.label, 'web'),
      sv: user.sessionVersion,
      expiresAt: new Date(now.getTime() + WEB_TTL_S * 1000),
    },
    db
  );
}

/**
 * Lazy upgrade of a live pre-B1a website cookie: a row keyed by the cookie's
 * own NextAuth jti (stable until the session endpoint re-encodes the cookie,
 * at which point the token already carries sid), so repeated server-side
 * reads of the same cookie upsert one row. sv is 0 by law: a legacy token
 * dies the moment the user's version moves.
 */
export async function upgradeLegacyWebSession(
  input: { userId: string; cookieJti: string; now?: Date },
  db: Db = prisma
): Promise<MintedRow> {
  const now = input.now ?? new Date();
  const jti = `legacy-web:${input.cookieJti}`;
  const expiresAt = new Date(now.getTime() + WEB_TTL_S * 1000);
  await db.deviceSession.upsert({
    where: { jti },
    create: {
      jti,
      userId: input.userId,
      kind: 'WEB',
      label: 'web (pre-B1a cookie)',
      sv: 0,
      expiresAt,
    },
    update: {},
  });
  return { jti, sv: 0, expiresAt };
}

/** Revoke one session and every child that names it as parent, in one statement. */
export async function revokeSession(
  jti: string,
  reason: RevokeReason,
  db: Db = prisma,
  now: Date = new Date()
): Promise<number> {
  const result = await db.deviceSession.updateMany({
    where: { revokedAt: null, OR: [{ jti }, { parentJti: jti }] },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count;
}

/**
 * Device logout by a WEB session alone (today's shells send only the cookie):
 * when the row was bridged from a BEARER, that BEARER is the device and goes
 * with all its children; a plain website session revokes itself only.
 */
export async function revokeDeviceByWebSession(
  webJti: string,
  reason: RevokeReason,
  db: Db = prisma,
  now: Date = new Date()
): Promise<number> {
  const row = await db.deviceSession.findUnique({
    where: { jti: webJti },
    select: { parentJti: true },
  });
  if (!row) return 0;
  return revokeSession(row.parentJti ?? webJti, reason, db, now);
}

/** Sign out everywhere: bump the version and revoke every live row, atomically. */
export async function revokeAllSessions(
  userId: string,
  reason: RevokeReason,
  now: Date = new Date()
): Promise<{ sessionVersion: number; revoked: number }> {
  return prisma.$transaction(async (tx) => revokeAllSessionsInTx(tx, userId, reason, now));
}

export async function revokeAllSessionsInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: RevokeReason,
  now: Date = new Date()
): Promise<{ sessionVersion: number; revoked: number }> {
  const user = await tx.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  const revoked = await tx.deviceSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return { sessionVersion: user.sessionVersion, revoked: revoked.count };
}

/**
 * Daily sweep: spent bridge codes and native handoff codes past expiry, rows
 * ended more than thirty days ago.
 */
export async function sweepSessionRows(
  now: Date = new Date()
): Promise<{ bridgeCodes: number; sessions: number; handoffCodes: number }> {
  const ended = new Date(now.getTime() - ROW_RETENTION_AFTER_END_MS);
  const [codes, rows, handoffs] = await prisma.$transaction([
    prisma.bridgeCodeUse.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.deviceSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: ended } }, { revokedAt: { lt: ended } }] },
    }),
    prisma.nativeHandoffCode.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { bridgeCodes: codes.count, sessions: rows.count, handoffCodes: handoffs.count };
}
