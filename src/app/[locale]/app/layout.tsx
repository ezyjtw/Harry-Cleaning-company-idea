import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ChromeHider from '@/components/ChromeHider';
import { isRenaShell } from '@/lib/shell';

// The Rena Pro purpose-built screens (Today, Offer). Rendered chrome-free inside
// the native shell — the native tab bar replaces the marketing nav/footer
// (hidden via ChromeHider). Served only to the shell in production; previewable
// in a browser in dev so the web team + James can iterate.
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const inShell = isRenaShell(headersList);

  if (!inShell && process.env.NODE_ENV === 'production') {
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
