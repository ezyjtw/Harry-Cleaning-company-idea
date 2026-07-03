'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// A11c: friendly unsubscribe landing. The List-Unsubscribe header already lets
// mail clients one-click opt out; this page is the human-facing path from the
// footer link. It POSTs the token to /api/unsubscribe on load and confirms.

type Status = 'working' | 'done' | 'error';

export default function UnsubscribePage() {
  const [status, setStatus] = useState<Status>('working');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' })
      .then((res) => setStatus(res.ok ? 'done' : 'error'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      {status === 'working' && <p className="text-sm text-gray-500">Updating your preferences…</p>}

      {status === 'done' && (
        <>
          <h1 className="font-newsreader text-3xl font-semibold text-ink">
            You&rsquo;ve been unsubscribed
          </h1>
          <p className="mt-4 font-jost text-sm font-light text-ink-2">
            You will no longer receive marketing emails from Rena. You&rsquo;ll still get essential
            messages about your bookings, payments and account security.
          </p>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            Changed your mind? You can opt back in any time from{' '}
            <Link href="/account/notifications" className="text-gold underline">
              your notification settings
            </Link>
            .
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="font-newsreader text-3xl font-semibold text-ink">Link not valid</h1>
          <p className="mt-4 font-jost text-sm font-light text-ink-2">
            This unsubscribe link is invalid or has already been used. You can manage all your email
            preferences from{' '}
            <Link href="/account/notifications" className="text-gold underline">
              your notification settings
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
