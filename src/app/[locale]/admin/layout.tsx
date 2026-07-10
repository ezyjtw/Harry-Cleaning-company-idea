import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';

import AdminChrome from './AdminChrome';

// SECURITY (S1) belt-and-braces: a SERVER-side ADMIN check wrapping every /admin
// page, so no admin page can ever ship exposed even if the middleware role gate
// regresses. The middleware enforces the same rule first (role-home redirect);
// this layout is the second, independent lock. The visual chrome lives in
// AdminChrome (client) — this file must stay a server component so the session
// check runs before any admin data renders. Non-admins go to their role home
// DIRECTLY (no /dashboard junction); no readable session goes to /login.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'ADMIN') {
    redirect(!user ? '/login' : user.role === 'CLEANER' ? '/cleaner' : '/account');
  }

  return <AdminChrome>{children}</AdminChrome>;
}
