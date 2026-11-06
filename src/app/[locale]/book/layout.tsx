import type { Metadata } from 'next';

// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

// A1-P1: checkout surface — never index. The page itself is a client
// component, so the robots directive lives in this pass-through layout.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
