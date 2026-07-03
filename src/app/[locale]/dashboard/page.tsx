'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';

// The customer dashboard content now lives inside the account shell as the
// "Home" tab (/account). This route is kept as a role-aware redirect so every
// existing landing link — post-login/signup, booking confirmation, booking
// back-links, the navbar — keeps working. Customers land on /account; cleaners
// and admins are sent to their own dashboards (unchanged behaviour).
export default function DashboardRedirect() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isCleaner, isAdmin } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?callbackUrl=/account');
      return;
    }
    if (isCleaner) {
      router.replace('/cleaner');
      return;
    }
    if (isAdmin) {
      router.replace('/admin');
      return;
    }
    router.replace('/account');
  }, [isLoading, isAuthenticated, isCleaner, isAdmin, router]);

  return null;
}
