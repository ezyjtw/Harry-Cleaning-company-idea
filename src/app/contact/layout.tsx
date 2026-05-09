import { generatePageMetadata } from '@/lib/seo/metadata';

export const metadata = generatePageMetadata({
  title: 'Contact Us',
  description:
    'Get in touch with the Rena team. We are here to help with bookings, cleaner enquiries, and support.',
  path: '/contact',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
