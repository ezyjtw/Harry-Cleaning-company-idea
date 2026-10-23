import { generatePageMetadata } from '@/lib/seo/metadata';

// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

export const metadata = generatePageMetadata({
  title: 'Sign Up',
  description: 'Create your free Rena account. Book trusted cleaners or join as a cleaner today.',
  path: '/signup',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
