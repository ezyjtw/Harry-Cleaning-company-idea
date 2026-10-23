// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

import CleanerLayoutClient from './CleanerLayoutClient';

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  return <CleanerLayoutClient>{children}</CleanerLayoutClient>;
}
