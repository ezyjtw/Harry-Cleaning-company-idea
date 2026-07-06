import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ChromeHider from '@/components/ChromeHider';
import { isRenaShell } from '@/lib/shell';

// The Rena Pro purpose-built screens (Today, Offer). Rendered chrome-free inside
// the native shell — the native tab bar replaces the marketing nav/footer
// (hidden via ChromeHider). Served only to the shell in production, EXCEPT for a
// human preview: append ?shell=1 once (the middleware persists a `rena-app-preview`
// cookie) so James can view /app/* logged in on the live deploy. Previewable
// freely in dev.
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);
  const inShell = isRenaShell(headersList);
  const previewCookie = cookieStore.get('rena-app-preview')?.value === '1';

  if (!inShell && !previewCookie && process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Suppress the marketing nav/footer — the native shell owns chrome. */}
      <ChromeHider bodyClass="portal-active" />
      <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}
