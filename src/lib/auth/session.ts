import { getServerSession } from 'next-auth';

import { authOptions } from './options';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Get the current authenticated session user.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as SessionUser;
  if (!user.id) return null;
  return user;
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
