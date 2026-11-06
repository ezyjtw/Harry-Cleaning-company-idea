import type { Metadata } from 'next';

// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

// A1-P1: transactional booking views (incl. guest-token access) — never index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
