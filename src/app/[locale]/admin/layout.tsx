import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/auth/session';

import AdminChrome from './AdminChrome';

// SECURITY (S1) belt-and-braces: a SERVER-side ADMIN check wrapping every /admin
// page, so no admin page can ever ship exposed even if the middleware role gate
// regresses. The middleware enforces the same rule first (redirect non-admins to
// /dashboard); this layout is the second, independent lock. The visual chrome
// lives in AdminChrome (client) — this file must stay a server component so the
// session check runs before any admin data renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect('/dashboard');
  }

  return <AdminChrome>{children}</AdminChrome>;
}
