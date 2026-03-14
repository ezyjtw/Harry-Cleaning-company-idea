'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()

  const user = session?.user
    ? {
        id: (session.user as any).id as string,
        name: session.user.name ?? '',
        email: session.user.email ?? '',
        role: (session.user as any).role as 'CLIENT' | 'CLEANER' | 'ADMIN',
      }
    : null

  return {
    user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isClient: user?.role === 'CLIENT',
    isCleaner: user?.role === 'CLEANER',
    isAdmin: user?.role === 'ADMIN',
    signIn,
    signOut,
  }
}
