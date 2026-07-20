'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

// Stuck-money reaper: the one-question customer surface — "did this clean
// happen?" The emailed askToken is the authorization. Yes/no is recorded on
// the case for the admin's decision; nothing here moves money.

interface CheckData {
  serviceType: string;
  date: string;
  startTime: string;
  cleanerName: string;
  answered: boolean;
  resolved: boolean;
}

function JobCheckForm() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<CheckData | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<'YES' | 'NO' | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(t);
    if (!t) {
      setError('This link is missing its token — please use the link from your email.');
      return;
    }
    fetch(`/api/job-check?token=${encodeURIComponent(t)}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setData(d);
        else setError(d.error || 'This link is not valid.');
      })
      .catch(() => setError('Something went wrong. Please try again.'));
  }, []);

  const answer = async (a: 'YES' | 'NO') => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/job-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answer: a }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setDone(a);
      else setError(d.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const dateStr = data
    ? new Date(data.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-cream px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="font-etna text-3xl tracking-wide text-ink">
            RENA
          </Link>
          <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
            One quick question
          </h1>
        </div>

        {error && !data ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="font-jost text-sm text-ink-2">{error}</p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-trust/30 bg-green-50 p-6 text-center">
            <p className="font-jost text-sm font-medium text-trust">
              {done === 'YES'
                ? 'Thank you for confirming — we’ll close the booking and release your cleaner’s payment.'
                : 'Thank you for telling us — our team will arrange your refund and be in touch.'}
            </p>
          </div>
        ) : data?.answered || data?.resolved ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="font-jost text-sm text-ink-2">
              {data.resolved
                ? 'This booking has already been resolved — nothing more is needed.'
                : 'You’ve already answered — thank you.'}
            </p>
          </div>
        ) : data ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
            <p className="font-jost text-sm text-ink-2">
              Did your clean with <span className="font-medium text-ink">{data.cleanerName}</span>{' '}
              on <span className="font-medium text-ink">{dateStr}</span> at {data.startTime} go
              ahead?
            </p>
            {error && <p className="mt-3 font-jost text-sm text-danger">{error}</p>}
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => answer('YES')}
                disabled={submitting}
                className="rounded-[10px] bg-trust px-6 py-2.5 font-jost text-sm font-semibold text-white transition-colors hover:bg-trust/90 disabled:opacity-50"
              >
                Yes, it happened
              </button>
              <button
                onClick={() => answer('NO')}
                disabled={submitting}
                className="rounded-[10px] border border-danger/40 px-6 py-2.5 font-jost text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              >
                No, it didn&apos;t
              </button>
            </div>
          </div>
        ) : (
          <div className="h-32 animate-pulse rounded-2xl bg-line" />
        )}
      </div>
    </div>
  );
}

export default function JobCheckPage() {
  return (
    <Suspense fallback={null}>
      <JobCheckForm />
    </Suspense>
  );
}
