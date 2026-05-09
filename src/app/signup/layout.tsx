import { generatePageMetadata } from '@/lib/seo/metadata';

export const metadata = generatePageMetadata({
  title: 'Sign Up',
  description: 'Create your free Rena account. Book trusted cleaners or join as a cleaner today.',
  path: '/signup',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
