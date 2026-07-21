'use client';

import { useEffect, useState } from 'react';

// H92: soft "verify your email" prompt for cleaners (James-ruled: prompt, not
// a hard block — the wizard and portal stay reachable). Verified email is what
// guest-booking claim keys on and what payout mail trusts, so the nudge is
// persistent until verified. Renders nothing while loading, for verified
// users, or on fetch failure (never blocks the portal on a hiccup).
export default function VerifyEmailBanner() {
  const [email, setEmail] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const u = data.user ?? data;
        if (u && u.email && !u.emailVerified) {
          setEmail(u.email);
          setUnverified(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!unverified) return null;

  const resend = async () => {
    if (sending || sent) return;
    setSending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="font-jost text-sm text-amber-900">
        <span className="font-medium">Verify your email.</span> We sent a link to{' '}
        <span className="font-medium">{email}</span> — verifying protects your account and makes
        sure job and payout emails reach you.
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={sending || sent}
        className="rounded-[8px] border border-amber-300 bg-white px-3 py-1.5 font-jost text-sm text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
      >
        {sent ? 'Sent — check your inbox' : sending ? 'Sending…' : 'Resend link'}
      </button>
    </div>
  );
}
