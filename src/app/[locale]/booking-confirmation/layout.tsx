import type { Metadata } from 'next';

// A1-P1: post-checkout confirmation — never index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookingConfirmationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
