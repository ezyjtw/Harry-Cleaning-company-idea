'use client';

// Ledger clearance (James-ruled): the BARE /regular-clean path was a 404 —
// now a friendly redirect. Browsers land on the regular-clean booking entry;
// the customer shell lands on its Book tab. The tokened /regular-clean/[id]
// guest route is untouched — this page exists only for the bare path.
// Shell detection is client-side after mount, so the SSR payload is identical
// for every UA (leak-proofing law).

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { isCustomerShellUA } from '@/lib/shell';

export default function RegularCleanRedirect() {
  const router = useRouter();
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    router.replace(isCustomerShellUA() || preview ? '/app/book' : '/services/regular');
  }, [router]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-page">
      <p className="font-jost text-sm font-light text-ink-3">Taking you to booking…</p>
    </div>
  );
}
