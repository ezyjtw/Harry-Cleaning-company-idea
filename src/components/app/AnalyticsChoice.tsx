'use client';

import { useEffect, useState } from 'react';

import { currentConsent, saveConsent, subscribeConsent } from '@/lib/consent';

// RENA-059 (D-b, B1b): the settings door for the analytics choice, shared by
// the Pro profile room and the customer settings page (website and in-shell).
// Signed-in only (both hosts are signed-in pages), so the gate writes the
// account's ledger answer. Marketing is carried over unchanged.
export default function AnalyticsChoice({ variant = 'row' }: { variant?: 'row' | 'section' }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => {
      const c = currentConsent();
      setAllowed(c ? c.analytics : null);
    };
    read();
    return subscribeConsent(read);
  }, []);

  const set = async (analytics: boolean) => {
    if (busy) return;
    setBusy(true);
    const marketing = currentConsent()?.marketing ?? false;
    await saveConsent({ analytics, marketing });
    setBusy(false);
  };

  const label =
    allowed === null ? 'Not chosen yet' : allowed ? 'Analytics allowed' : 'Essential only';

  return (
    <div
      className={
        variant === 'row'
          ? 'flex w-full items-center justify-between gap-3 px-5 py-4'
          : 'flex flex-wrap items-center justify-between gap-3'
      }
      data-testid="analytics-choice"
    >
      <div className="min-w-0">
        <p className="font-jost text-[15px] font-medium text-ink">Analytics</p>
        <p
          className="mt-0.5 font-jost text-[12px] font-normal text-ink-3"
          data-testid="analytics-choice-state"
        >
          {label}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={busy || allowed === true}
          onClick={() => set(true)}
          data-testid="analytics-choice-allow"
          className="rounded-[10px] border border-line px-3 py-2 font-jost text-[12px] font-medium text-ink disabled:opacity-40"
        >
          Allow
        </button>
        <button
          type="button"
          disabled={busy || allowed === false}
          onClick={() => set(false)}
          data-testid="analytics-choice-essential"
          className="rounded-[10px] border border-line px-3 py-2 font-jost text-[12px] font-medium text-ink disabled:opacity-40"
        >
          Essential only
        </button>
      </div>
    </div>
  );
}
