'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isShellUA } from '@/lib/shell';

// H88: launch-time stand-in for the live-chat FAB — same position, same
// footprint (the H50 mobile padding law assumes a bottom-right FAB), but it
// opens the contact form instead of a chat panel. Hidden on /contact itself,
// where the form is already the page. Never renders inside the Rena Pro shell
// (James-ruled chrome strip). The shell check is a POST-MOUNT effect, not an
// in-render read: a render-time isShellUA() only removed the server-rendered
// FAB when some other hydration mismatch happened to force a client re-render
// (P2.5 finding). SSR and the hydration pass render the link exactly as before
// — browser visitors' HTML is byte-identical — and the effect fires only
// inside the shell, where the injected chrome CSS already hides it anyway.
export default function ContactFab() {
  const pathname = usePathname();
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    if (isShellUA()) setInShell(true);
  }, []);
  if (pathname === '/contact') return null;
  if (inShell) return null;

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
