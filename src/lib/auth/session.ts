import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';

import prisma from '@/lib/db/prisma';

import { authOptions } from './options';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set. Cannot sign or verify tokens.');
}
const JWT_SECRET: string = process.env.NEXTAUTH_SECRET;

// R2: tolerance for the password-change/issue-time comparison. JWT issue times
// (NextAuth pwdAt, jsonwebtoken iat) are floored to whole seconds; the DB's
// passwordChangedAt keeps milliseconds — so a session minted in the same second
// as the change compared as "older" and was wrongly killed.
const PASSWORD_CHANGE_GRACE_MS = 2000;

/**
 * Generate a signed JWT token for mobile/API clients.
 */
export function generateApiToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d', issuer: 'rena-cleaning' }
  );
}

// ─── Rena Pro session-bridge code ────────────────────────────────────────────
//
// A single-use, 60-second code the login/signup response hands the native shell.
// The shell exchanges it (once) at /api/auth/session-bridge for a NextAuth
// session cookie in the WebView. Deliberately NOT the long-lived Bearer: the code
// is short-exp and one-time, so its appearance in a redirect URL / server log is
// low-value. Distinct issuer ('rena-bridge') so the bridge can reject a Bearer
// (issuer 'rena-cleaning') outright.
const BRIDGE_CODE_TTL_S = 60;
const consumedBridgeJtis = new Map<string, number>(); // jti → expiry (ms)

// Drop consumed jtis once they've expired (they can never be replayed after exp).
setInterval(() => {
  const now = Date.now();
  consumedBridgeJtis.forEach((exp, jti) => {
    if (exp < now) consumedBridgeJtis.delete(jti);
  });
}, 60 * 1000);

export function generateBridgeCode(user: { id: string }): string {
  const jti = randomUUID();
  return jwt.sign({ id: user.id, jti }, JWT_SECRET, {
    expiresIn: BRIDGE_CODE_TTL_S,
    issuer: 'rena-bridge',
  });
}

/**
 * Verify a bridge code and CONSUME it (single-use). Returns the active user, or
 * null if the code is invalid/expired/already-used or the user is gone/suspended.
 */
export async function verifyAndConsumeBridgeCode(code: string): Promise<SessionUser | null> {
  let payload: { id: string; jti: string; exp?: number };
  try {
    payload = jwt.verify(code, JWT_SECRET, { issuer: 'rena-bridge' }) as {
      id: string;
      jti: string;
      exp?: number;
    };
  } catch {
    return null;
  }

  if (!payload.jti || consumedBridgeJtis.has(payload.jti)) return null; // replay / missing jti
  // Mark consumed immediately (before the DB read) so concurrent uses can't both win.
  consumedBridgeJtis.set(payload.jti, (payload.exp ?? Math.floor(Date.now() / 1000) + BRIDGE_CODE_TTL_S) * 1000);

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, role: true, accountStatus: true, isSuspended: true },
  });
  if (!user || user.accountStatus !== 'ACTIVE' || user.isSuspended) return null;

  return { id: user.id, email: user.email, name: user.name || '', role: user.role };
}

/**
 * Verify a Bearer token and return the user payload.
 * Returns null if the token is invalid or the user no longer exists/is active.
 */
async function verifyBearerToken(token: string): Promise<SessionUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'rena-cleaning' }) as {
      id: string;
      email: string;
      name: string;
      role: string;
      iat?: number;
    };

    // Verify the user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        isSuspended: true,
        passwordChangedAt: true,
      },
    });

    if (!user || user.accountStatus !== 'ACTIVE' || user.isSuspended) {
      return null;
    }
    // F6: Bearer tokens issued before a password change are dead too.
    // R2: issue-time stamps are floored to the second while passwordChangedAt
    // has ms precision — a token minted in the same second as the change lost
    // the comparison and a VALID fresh token was rejected. 2s of grace kills
    // the race (the only sessions inside the window belong to the device that
    // just set the new password). Tokens without iat predate the F6 deploy and
    // are accepted rather than rejected: they can't be password-revoked, but
    // they age out naturally and every new token carries the stamp.
    if (
      user.passwordChangedAt &&
      payload.iat &&
      user.passwordChangedAt.getTime() > payload.iat * 1000 + PASSWORD_CHANGE_GRACE_MS
    ) {
      return null;
    }

    return { id: user.id, email: user.email, name: user.name || '', role: user.role };
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated session user.
 * Supports both NextAuth session cookies (web) and Bearer tokens (mobile/API).
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // 1. Try NextAuth session first (web clients)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const user = session.user as SessionUser;
    if (user.id) {
      // F6/F1: JWT sessions can't be revoked server-side, so EVERY API call
      // re-checks the DB: dead if the account is no longer ACTIVE (immediate
      // deactivation on deletion requests / suspensions) or if the password
      // changed after this session was issued (change-password invalidates
      // every other session). One indexed point-read per request.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { accountStatus: true, isSuspended: true, passwordChangedAt: true },
      });
      if (!dbUser || dbUser.accountStatus !== 'ACTIVE' || dbUser.isSuspended) return null;
      // R2: pwdAt is floored to the second while passwordChangedAt keeps ms —
      // the settings page's silent re-sign-in after a password change could
      // mint a session in the same second and be rejected as "issued before
      // the change" (login didn't stick). 2s grace closes the race. Sessions
      // WITHOUT pwdAt predate the F6 deploy and are accepted, not rejected:
      // rejecting them permanently bounced valid 30-day sessions for anyone
      // who had ever changed their password.
      const issuedAt = (session.user as { pwdAt?: number }).pwdAt;
      if (
        dbUser.passwordChangedAt &&
        issuedAt &&
        dbUser.passwordChangedAt.getTime() > issuedAt * 1000 + PASSWORD_CHANGE_GRACE_MS
      ) {
        return null;
      }
      return user;
    }
  }

  // 2. Fall back to Bearer token (mobile/API clients)
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      return await verifyBearerToken(token);
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

/**
 * Check if the authenticated user owns or is a team member of the given company.
 * Returns the user if authorized, null otherwise.
 */
export async function getCompanyMemberSession(companyId: string): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;

  // Admins can access any company
  if (user.role === 'ADMIN') return user;

  // Check if user is the company owner
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });

  if (company?.ownerId === user.id) return user;

  // Check if user is a team member
  const membership = await prisma.teamMember.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
    select: { isActive: true },
  });

  if (membership?.isActive) return user;

  return null;
}
