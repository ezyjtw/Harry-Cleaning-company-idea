'use client';

import { useEffect } from 'react';

import { isCustomerShellUA } from '@/lib/shell';

// Rena customer app chrome rule (James-ruled, Phase 1): inside the customer
// shell the native tab bar owns the chrome, so the marketing nav + footer
// hide via the `rena-customer-shell` body class (globals.css). Page content
// stays whole. Effect-only, mount-gated — SSR and the hydration pass render
// nothing shell-specific, so browser visitors' HTML is byte-identical; the
// class appears only under the RenaApp/ UA or James's `?shell=1` preview
// cookie (`rena-customer-preview`, mirroring Pro's browser preview).
export default function CustomerShellChrome() {
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (!isCustomerShellUA() && !preview) return;
    document.body.classList.add('rena-customer-shell');
    return () => document.body.classList.remove('rena-customer-shell');
  }, []);
  return null;
}
