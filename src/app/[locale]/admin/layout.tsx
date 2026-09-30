import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';

import AdminChrome from './AdminChrome';

// R9 (HQ PWA): admin pages declare their OWN manifest (id + scope /admin,
// start_url /admin/hq) — a per-page manifest link overrides the root
// /manifest.json, and the distinct id makes Chrome offer "Install" as a
// SEPARATE app from the public-site PWA. Linked ONLY from this admin layout,
// so public bytes are untouched by construction. Deliberately NO service
// worker: installability doesn't need one, and having none is the proof the
// admin app can never cache or serve public routes.
export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
};

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
