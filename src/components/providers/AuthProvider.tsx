'use client';
import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

import { clearAllStale } from '@/lib/freshness';

// RENA-018 (B2a): no freshness marker outlives an account on a shared device.
// Every sign out path (the website buttons, the R6 401 belt, the shell's
// logout) ends with the session reading unauthenticated, so the markers are
// cleared at that one transition instead of at each caller. Renders nothing.
function StaleMarkerReset() {
  const { status } = useSession();
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (status === 'authenticated') wasAuthenticated.current = true;
    if (status === 'unauthenticated' && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      clearAllStale();
    }
  }, [status]);
  return null;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StaleMarkerReset />
      {children}
    </SessionProvider>
  );
}
