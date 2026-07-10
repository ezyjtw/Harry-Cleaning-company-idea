import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/options';

// /dashboard is a pure junction — it must be INCAPABLE of dying. Logins now
// navigate straight to the role home (login page + middleware both role-route),
// so this page only serves legacy links/bookmarks and post-login fallbacks.
//
// Robustness rules:
// - never render anything: every path ends in redirect()
// - redirect() throws NEXT_REDIRECT BY DESIGN, so it must sit OUTSIDE the
//   try/catch — catching it turns a redirect into a 500 (the classic mistake)
// - ANY session-read failure falls back to /login, never an error page
export const dynamic = 'force-dynamic';

export default async function DashboardRedirect() {
  let target = '/login?callbackUrl=/account';
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const role = session.user.role;
      target = role === 'CLEANER' ? '/cleaner' : role === 'ADMIN' ? '/admin' : '/account';
    }
  } catch {
    // Session unreadable (malformed cookie, secret mismatch, anything) —
    // treat as signed out rather than surfacing a server error.
    target = '/login?callbackUrl=/account';
  }
  redirect(target);
}
