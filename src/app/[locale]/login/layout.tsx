import { generatePageMetadata } from '@/lib/seo/metadata';

// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

export const metadata = generatePageMetadata({
  title: 'Log In',
  description: 'Log in to your Rena account to manage bookings, reviews, and your profile.',
  path: '/login',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
