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
  '/regular-clean',
  '/services', // the bare sales landing — the flow's /services/[category] steps stay sanctioned
]);

export default function CustomerShellChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [inShell, setInShell] = useState(false);

  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (!isCustomerShellUA() && !preview) return;
    setInShell(true);
    document.body.classList.add('rena-customer-shell');
    return () => document.body.classList.remove('rena-customer-shell');
  }, []);

  useEffect(() => {
    if (!inShell || !pathname) return;
    const bare = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    if (MARKETING_ROUTES.has(bare)) {
      router.replace('/app/home');
    }
  }, [inShell, pathname, router]);

  return null;
}
