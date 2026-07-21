'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// A16b-2a: friendly landing for the one-click email-verification link.
// Statuses come from /api/auth/verify-email: verified | already_verified | expired | invalid.

type Status = 'verified' | 'already_verified' | 'expired' | 'invalid';

const COPY: Record<Status, { title: string; body: string; tone: 'ok' | 'warn' }> = {
  verified: {
    title: 'Email verified',
    body: "You're all set — your email address has been confirmed.",
    tone: 'ok',
  },
  already_verified: {
    title: 'Already verified',
    body: "Your email is already confirmed — you're all set. You can safely close this page.",
    tone: 'ok',
  },
  expired: {
    title: 'Link expired',
    body: 'This verification link has expired. Enter your email below and we’ll send a fresh one.',
    tone: 'warn',
  },
  invalid: {
    title: 'Link no longer valid',
    body: 'This link is invalid or has already been used. If your email isn’t verified yet, request a new link below.',
    tone: 'warn',
  },
};

export default function VerifyEmailPage() {
  const params = useSearchParams();
  // H95: emails sent before the template fix carry ?token= pointing at THIS
  // page — forward them to the consuming route so those links verify instead
  // of dead-ending. The route 303s straight back here with a status.
  const strayToken = params.get('token');
  const hasStatus = params.get('status') !== null;
  useEffect(() => {
    if (strayToken && !hasStatus) {
      window.location.replace(`/api/auth/verify-email?token=${encodeURIComponent(strayToken)}`);
    }
  }, [strayToken, hasStatus]);

  const status = (params.get('status') as Status) || 'invalid';
  const copy = COPY[status] ?? COPY.invalid;
  const canResend = status === 'expired' || status === 'invalid';
  const forwarding = Boolean(strayToken && !hasStatus);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? data.message || 'If an unverified account exists for that email, we’ve sent a new link.'
          : data.error || 'Something went wrong. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  if (forwarding) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 font-jost text-sm text-ink-3">Verifying your email…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div
        className="rounded-2xl bg-white p-8 text-center"
        style={{ border: '1px solid rgba(14,14,12,0.08)' }}
      >
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            copy.tone === 'ok' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {copy.tone === 'ok' ? '✓' : '!'}
        </span>
        <h1 className="mt-4 font-newsreader text-[26px] font-semibold text-ink">{copy.title}</h1>
        <p className="mt-2 font-jost text-[14px] text-ink-3">{copy.body}</p>

        {canResend && (
          <form onSubmit={resend} className="mt-6 space-y-3 text-left">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-jost text-sm text-ink"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-full bg-ink px-6 py-2.5 font-jost text-[12px] uppercase tracking-[0.1em] text-cream hover:bg-ink/90 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Resend verification email'}
            </button>
            {msg && <p className="font-jost text-[13px] text-ink-2">{msg}</p>}
          </form>
        )}

        <div className="mt-6">
          <Link href="/login" className="font-jost text-[13px] text-gold hover:underline">
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
