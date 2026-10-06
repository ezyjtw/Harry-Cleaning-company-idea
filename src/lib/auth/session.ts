import { randomUUID } from 'crypto';

import type { DeviceSessionKind } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';

import prisma from '@/lib/db/prisma';

import {
  BEARER_TTL_S,
  LAST_SEEN_WRITE_INTERVAL_MS,
  WEB_TTL_S,
  legacyTokensAccepted,
  mintDeviceSession,
  sessionLabel,
} from './device-session';
import { authOptions } from './options';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  /** The DeviceSession jti this request authenticated with; null for a grandfathered legacy token. */
  sessionJti: string | null;
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set. Cannot sign or verify tokens.');
}
const JWT_SECRET: string = process.env.NEXTAUTH_SECRET;

// R2: tolerance for the password-change/issue-time comparison. JWT issue times
// (NextAuth pwdAt, jsonwebtoken iat) are floored to whole seconds; the DB's
// passwordChangedAt keeps milliseconds, so a session minted in the same second
// as the change compared as "older" and was wrongly killed.
const PASSWORD_CHANGE_GRACE_MS = 2000;

export const BEARER_ISSUER = 'rena-cleaning';
export const BRIDGE_ISSUER = 'rena-bridge';
export const BRIDGE_CODE_TTL_S = 60;

interface BearerClaims {
  id: string;
  email: string;
  name: string;
  role: string;
  sv?: number;
  jti?: string;
  iat?: number;
}

/**
 * RENA-007 (D-g): mint a 30-day Bearer for a native shell. The row is written
 * first; the token carries the row's jti and the user's sessionVersion.
 */
export async function generateApiToken(
  user: { id: string; email: string; name: string; role: string },
  options: { label?: string | null } = {}
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const now = new Date();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  if (!dbUser) throw new Error('generateApiToken: user not found');
  const row = await mintDeviceSession({
    userId: user.id,
    kind: 'BEARER',
    label: sessionLabel(options.label, 'native'),
    sv: dbUser.sessionVersion,
    expiresAt: new Date(now.getTime() + BEARER_TTL_S * 1000),
  });
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, sv: row.sv },
    JWT_SECRET,
    { expiresIn: BEARER_TTL_S, issuer: BEARER_ISSUER, jwtid: row.jti }
  );
  return { token, jti: row.jti, expiresAt: row.expiresAt };
}

// ─── Rena Pro session-bridge code ────────────────────────────────────────────
//
// A single-use, 60-second code the login/signup response hands the native shell.
// The shell exchanges it (once) at /api/auth/session-bridge for a NextAuth
// session cookie in the WebView. Deliberately NOT the long-lived Bearer: the code
// is short-exp and one-time, so its appearance in a redirect URL / server log is
// low-value. Distinct issuer ('rena-bridge') so the bridge can reject a Bearer
// (issuer 'rena-cleaning') outright. RENA-003: the code names the Bearer that
// minted it (bjti); redemption claims the code's jti in BridgeCodeUse and
// verifies that parent in ONE transaction.

export function generateBridgeCode(user: { id: string; bearerJti: string }): string {
  return jwt.sign({ id: user.id, bjti: user.bearerJti }, JWT_SECRET, {
    expiresIn: BRIDGE_CODE_TTL_S,
    issuer: BRIDGE_ISSUER,
    jwtid: randomUUID(),
  });
}

export interface BridgeRedemption {
  user: SessionUser;
  /** The WEB row minted for the WebView; the cookie carries it as sid. */
  webJti: string;
  expiresAt: Date;
  sv: number;
}

class BridgeParentInvalid extends Error {}

/**
 * Verify a bridge code and CONSUME it (single-use, database-backed). Returns
 * the redemption, or null when the code is invalid, expired, already used, or
 * its parent Bearer fails the parent validity law: the row named in the code
 * must exist, belong to the same user, be kind BEARER, unrevoked, unexpired
 * and carry the user's current sessionVersion. Claim and verification run in
 * one transaction; two concurrent redemptions of one code give one winner.
 */
export async function verifyAndConsumeBridgeCode(
  code: string,
  now: Date = new Date()
): Promise<BridgeRedemption | null> {
  let payload: { id: string; bjti?: string; jti?: string; exp?: number };
  try {
    payload = jwt.verify(code, JWT_SECRET, {
      issuer: BRIDGE_ISSUER,
      clockTimestamp: Math.floor(now.getTime() / 1000),
    }) as {
      id: string;
      bjti?: string;
      jti?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
  if (!payload.jti || !payload.bjti || !payload.id) return null;
  const codeJti = payload.jti;
  const parentJti = payload.bjti;
  const userId = payload.id;
  const codeExpiry = new Date(
    (payload.exp ?? Math.floor(now.getTime() / 1000) + BRIDGE_CODE_TTL_S) * 1000
  );

  try {
    return await prisma.$transaction(async (tx) => {
      // Insert-as-claim: a unique violation here is a replay.
      await tx.bridgeCodeUse.create({ data: { jti: codeJti, expiresAt: codeExpiry } });

      const parent = await tx.deviceSession.findUnique({
        where: { jti: parentJti },
        select: {
          userId: true,
          kind: true,
          sv: true,
          revokedAt: true,
          expiresAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              accountStatus: true,
              isSuspended: true,
              sessionVersion: true,
            },
          },
        },
      });
      if (
        !parent ||
        parent.kind !== 'BEARER' ||
        parent.userId !== userId ||
        parent.revokedAt !== null ||
        parent.expiresAt.getTime() <= now.getTime() ||
        parent.user.accountStatus !== 'ACTIVE' ||
        parent.user.isSuspended ||
        parent.sv !== parent.user.sessionVersion
      ) {
        throw new BridgeParentInvalid('bridge parent invalid');
      }

      // Hierarchy law: the child never outlives its parent.
      const expiresAt = new Date(
        Math.min(parent.expiresAt.getTime(), now.getTime() + WEB_TTL_S * 1000)
      );
      const web = await mintDeviceSession(
        {
          userId,
          kind: 'WEB',
          label: 'bridge',
          sv: parent.sv,
          expiresAt,
          parentJti,
        },
        tx
      );
      return {
        user: {
          id: parent.user.id,
          email: parent.user.email,
          name: parent.user.name || '',
          role: parent.user.role,
          sessionJti: web.jti,
        },
        webJti: web.jti,
        expiresAt,
        sv: parent.sv,
      };
    });
  } catch {
    // Replay (unique violation), invalid parent, or a database failure: all null.
    return null;
  }
}

// ─── Per-request checks ──────────────────────────────────────────────────────

const SESSION_ROW_SELECT = {
  jti: true,
  userId: true,
  kind: true,
  sv: true,
  revokedAt: true,
  expiresAt: true,
  lastSeenAt: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      isSuspended: true,
      passwordChangedAt: true,
      sessionVersion: true,
    },
  },
} as const;

function issuedBeforePasswordChange(
  passwordChangedAt: Date | null,
  issuedAtS: number | undefined
): boolean {
  return (
    !!passwordChangedAt &&
    !!issuedAtS &&
    passwordChangedAt.getTime() > issuedAtS * 1000 + PASSWORD_CHANGE_GRACE_MS
  );
}

/**
 * The per-request check: ONE indexed lookup by jti carrying the user's
 * security fields, then a conditional lastSeenAt write at most every five
 * minutes. A child's parent is never read here (hierarchy law).
 */
async function checkSessionRow(input: {
  jti: string;
  kind: DeviceSessionKind;
  userId: string;
  claimedSv: number | undefined;
  issuedAtS: number | undefined;
  now: Date;
}): Promise<SessionUser | null> {
  const row = await prisma.deviceSession.findUnique({
    where: { jti: input.jti },
    select: SESSION_ROW_SELECT,
  });
  if (!row || row.kind !== input.kind || row.userId !== input.userId) return null;
  if (row.revokedAt !== null || row.expiresAt.getTime() <= input.now.getTime()) return null;
  const { user } = row;
  if (user.accountStatus !== 'ACTIVE' || user.isSuspended) return null;
  if ((input.claimedSv ?? 0) !== user.sessionVersion || row.sv !== user.sessionVersion) return null;
  if (issuedBeforePasswordChange(user.passwordChangedAt, input.issuedAtS)) return null;

  if (input.now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    await prisma.deviceSession
      .updateMany({
        where: {
          jti: input.jti,
          lastSeenAt: { lt: new Date(input.now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS) },
        },
        data: { lastSeenAt: input.now },
      })
      .catch(() => {});
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    role: user.role,
    sessionJti: row.jti,
  };
}

/** Grandfathered pre-B1a token: user read, version read as 0, until the cutoff. */
async function checkLegacyToken(input: {
  userId: string;
  claimedSv: number | undefined;
  issuedAtS: number | undefined;
  now: Date;
}): Promise<SessionUser | null> {
  if (!legacyTokensAccepted(input.now)) return null;
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      isSuspended: true,
      passwordChangedAt: true,
      sessionVersion: true,
    },
  });
  if (!user || user.accountStatus !== 'ACTIVE' || user.isSuspended) return null;
  if ((input.claimedSv ?? 0) !== user.sessionVersion) return null;
  if (issuedBeforePasswordChange(user.passwordChangedAt, input.issuedAtS)) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    role: user.role,
    sessionJti: null,
  };
}

/**
 * Verify a Bearer token and return the user payload.
 * Returns null if the token is invalid, revoked, version-stale, or the user
 * no longer exists/is active.
 */
export async function verifyBearerToken(
  token: string,
  now: Date = new Date()
): Promise<SessionUser | null> {
  let payload: BearerClaims;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      issuer: BEARER_ISSUER,
      clockTimestamp: Math.floor(now.getTime() / 1000),
    }) as BearerClaims;
  } catch {
    return null;
  }
  if (!payload.id) return null;
  if (payload.jti) {
    return checkSessionRow({
      jti: payload.jti,
      kind: 'BEARER',
      userId: payload.id,
      claimedSv: payload.sv,
      issuedAtS: payload.iat,
      now,
    });
  }
  return checkLegacyToken({
    userId: payload.id,
    claimedSv: payload.sv,
    issuedAtS: payload.iat,
    now,
  });
}

/** Read the Bearer's jti without a database read (for logout paths). */
export function readBearerJti(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: BEARER_ISSUER }) as BearerClaims;
    return payload.jti ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated session user.
 * Supports both NextAuth session cookies (web) and Bearer tokens (mobile/API).
 * Returns null if not authenticated.
 */
export async function getSessionUser(now: Date = new Date()): Promise<SessionUser | null> {
  // 1. Try NextAuth session first (web clients)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const user = session.user as { id?: string; pwdAt?: number; sid?: string; sv?: number };
    if (user.id) {
      if (user.sid) {
        return checkSessionRow({
          jti: user.sid,
          kind: 'WEB',
          userId: user.id,
          claimedSv: user.sv,
          issuedAtS: user.pwdAt,
          now,
        });
      }
      return checkLegacyToken({ userId: user.id, claimedSv: user.sv, issuedAtS: user.pwdAt, now });
    }
  }

  // 2. Fall back to Bearer token (mobile/API clients)
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      return await verifyBearerToken(token, now);
    }
  } catch {
    // headers() may throw in some contexts; silently fall through
  }

  return null;
}

/**
 * Get session user and verify they have the CLEANER role.
 * Returns null if not authenticated or not a cleaner.
 */
export async function getCleanerSession(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== 'CLEANER') return null;
  return user;
}

/**
 * Get session user and verify they have the ADMIN role.
 * Returns null if not authenticated or not an admin.
 */
export async function getAdminSession(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}

/**
 * Require admin authentication. Returns the admin user or throws a Response.
 * Use in route handlers for clean early-return pattern.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getAdminSession();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}

/**
 * Require authenticated user. Returns the user or throws a Response.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
