import type { Metadata } from 'next';

// A1-P1: transactional booking views (incl. guest-token access) — never index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
