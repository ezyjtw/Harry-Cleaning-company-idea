import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ChromeHider from '@/components/ChromeHider';
import { isCustomerShell, isRenaShell } from '@/lib/shell';

// The Rena Pro purpose-built screens (Today, Offer). Rendered chrome-free inside
// the native shell — the native tab bar replaces the marketing nav/footer
// (hidden via ChromeHider). Served only to the shell in production, EXCEPT for a
// human preview: append ?shell=1 once — the middleware redirects to the clean URL
// with a `rena-app-preview` cookie set, so this render sees it immediately and
// every later /app/* navigation stays unlocked. Previewable freely in dev.
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [headersList, cookieStore] = await Promise.all([headers(), cookies()]);
  // Phase 2: the customer shell's L2 pages (/app/home, /app/book) live in this
  // namespace too, so EITHER shell (or either preview cookie) opens the
  // chrome-free wrapper. Pages stay role-scoped by their own session-guarded
  // data — a shell can load the other's route but gets no data through it.
  const inShell = isRenaShell(headersList) || isCustomerShell(headersList);
  const previewCookie =
    cookieStore.get('rena-app-preview')?.value === '1' ||
    cookieStore.get('rena-customer-preview')?.value === '1';

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
