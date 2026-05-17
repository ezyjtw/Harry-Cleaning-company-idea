'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? '',
        email: session.user.email ?? '',
        role: session.user.role,
      }
    : null;

  return {
    user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isClient: user?.role === 'CLIENT',
    isCleaner: user?.role === 'CLEANER',
    isAdmin: user?.role === 'ADMIN',
    signIn,
    signOut,
  };
}
