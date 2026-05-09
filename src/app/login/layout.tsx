import { generatePageMetadata } from '@/lib/seo/metadata';

export const metadata = generatePageMetadata({
  title: 'Log In',
  description: 'Log in to your Rena account to manage bookings, reviews, and your profile.',
  path: '/login',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
