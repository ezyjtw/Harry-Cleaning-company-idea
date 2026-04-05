import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';

import prisma from '@/lib/db/prisma';
import { authOptions } from './options';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-do-not-use-in-production';

/**
 * Generate a signed JWT token for mobile/API clients.
 */
export function generateApiToken(user: { id: string; email: string; name: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d', issuer: 'rena-cleaning' }
  );
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
    };

    // Verify the user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, accountStatus: true, isSuspended: true },
    });

    if (!user || user.accountStatus !== 'ACTIVE' || user.isSuspended) {
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
    if (user.id) return user;
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
