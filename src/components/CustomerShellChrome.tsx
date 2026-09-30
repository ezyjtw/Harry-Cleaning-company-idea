'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isCustomerShellUA } from '@/lib/shell';

// Rena customer app chrome rule (James-ruled, Phase 1): inside the customer
// shell the native tab bar owns the chrome, so the marketing nav + footer
// hide via the `rena-customer-shell` body class (globals.css). Page content
// stays whole. Effect-only, mount-gated — SSR and the hydration pass render
// nothing shell-specific, so browser visitors' HTML is byte-identical; the
// class appears only under the RenaApp/ UA or James's `?shell=1` preview
// cookie (`rena-customer-preview`, mirroring Pro's browser preview).
//
// Back-chain law backstop (James's on-device find): marketing pages are
// NEVER reachable in-shell by any chain of taps or backs. Any marketing
// route reached in-shell — an unswept link, a wordmark, a history walk —
// replaces itself with /app/home (replace, not push, so the back stack
// never accumulates marketing entries). Sanctioned rooms are untouched.
const MARKETING_ROUTES = new Set([
  '/',
  '/about',
  '/how-it-works',
  '/join',
  '/faq',
  '/pricing',
  '/guarantees',
  '/cleaning',
  // '/regular-clean' left the set (ledger clearance): the bare path is now
  // its own redirect page — in-shell it lands /app/book (ruled), never
  // rendering marketing content, so the backstop's /app/home would only
  // out-race the ruled destination.
  '/services', // the bare sales landing — the flow's /services/[category] steps stay sanctioned
]);

export default function CustomerShellChrome() {
  const pathname = usePathname();
  const router = useRouter();
  // Root-redirect drift fix (James-ruled): the chrome-hide serves the shell
  // UA AND James's `?shell=1` browser preview, but the back-chain backstop
  // is a SHELL law and fires only under the real shell UA. The preview
  // cookie previously rode the same flag, so any plain browser that had
  // ever used ?shell=1 got / (and every marketing route) replaced with
  // /app/home for the cookie's 30-day life. The front door is the front
  // door: a plain browser, signed in or not, always gets the homepage.
  const [realShell, setRealShell] = useState(false);

  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    const ua = isCustomerShellUA();
    if (!ua && !preview) return;
    if (ua) setRealShell(true);
    document.body.classList.add('rena-customer-shell');
    return () => document.body.classList.remove('rena-customer-shell');
  }, []);

  useEffect(() => {
    if (!realShell || !pathname) return;
    const bare = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    if (MARKETING_ROUTES.has(bare)) {
      router.replace('/app/home');
    }
  }, [realShell, pathname, router]);

  return null;
}
