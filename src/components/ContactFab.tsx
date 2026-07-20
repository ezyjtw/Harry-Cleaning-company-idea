'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// H88: launch-time stand-in for the live-chat FAB — same position, same
// footprint (the H50 mobile padding law assumes a bottom-right FAB), but it
// opens the contact form instead of a chat panel. Hidden on /contact itself,
// where the form is already the page.
export default function ContactFab() {
  const pathname = usePathname();
  if (pathname === '/contact') return null;

  return (
    <Link
      href="/contact"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg transition-all duration-300 hover:bg-primary-hover"
      aria-label="Contact us"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
      </svg>
    </Link>
  );
}
