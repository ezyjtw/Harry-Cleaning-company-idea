import { generatePageMetadata } from '@/lib/seo/metadata';

// RENA-051 (B6.3): static, regenerated hourly (the page is a client component).
export const revalidate = 3600;

export const metadata = generatePageMetadata({
  title: 'Contact Us',
  description:
    'Get in touch with the Rena team. We are here to help with bookings, cleaner enquiries, and support.',
  path: '/contact',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
