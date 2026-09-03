'use client';

// F26 (app scope ruling): banner-only parity for the L2 shell — a cleaner who
// hid their profile sees the same truth on /app/today as the web dashboard
// shows, with the same one-click way back. The full visibility control stays
// on the profile page (L3); this is deliberately just the banner.
// F26.1 strings ride verbatim — the rescue/cover exclusion is named.

import { useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

export default function HiddenProfileBanner({ className }: { className?: string }) {
  // null = unknown (loading/error) — the banner only renders on a definite false.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cleaner/profile');
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && typeof data?.visibleInDirectory === 'boolean') {
          setVisible(data.visibleInDirectory);
        }
      } catch {
        /* best-effort — no banner on error, never a broken surface */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (visible !== false) return null;

  return (
    <div
      data-testid="app-profile-hidden-banner"
      className={`rounded-2xl border border-amber-200 bg-amber-50 p-4 ${className || ''}`}
    >
      <p className="font-jost text-sm text-amber-900">
        Your profile is hidden — new customers can&apos;t find you, and you won&apos;t receive
        rescue or cover offers. Existing bookings and regular clients are unaffected.
      </p>
      <button
        type="button"
        data-testid="app-show-profile-button"
        disabled={showing}
        onClick={async () => {
          haptic('medium');
          setShowing(true);
          try {
            const res = await fetch('/api/cleaner/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ visibleInDirectory: true }),
            });
            if (res.ok) {
              haptic('success');
              setVisible(true);
            }
          } finally {
            setShowing(false);
          }
        }}
        className="mt-3 rounded-[10px] bg-amber-600 px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition active:bg-amber-700 disabled:opacity-60"
      >
        {showing ? 'Showing…' : 'Show profile'}
      </button>
    </div>
  );
}
