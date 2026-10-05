'use client';

// Pro account deletion door (James-ordered, Apple 5.1.1(v) launch blocker):
// the dressed in-app room where a cleaner closes their account. The door the
// customer app has lived as a modal built INLINE into the client portal's
// /account/settings page, so Rena Pro never had one. This room opens the SAME
// flow and the SAME engine, byte-untouched: POST /api/gdpr/deletion (password
// re-entry + type-to-confirm, server-verified; one open request at a time;
// cleaner blockers for live jobs, active regular cleans, payouts in flight,
// open disputes, pending adjustments — all 409, named, nothing deactivated).
// On success the account is DEACTIVATED at once and the web session is signed
// out to /en/login, which the shell reads as session-lost and drops to its
// native login screen. Erasure itself runs within 30 days behind the
// admin-approved workflow. L2 by construction: no website chrome exists here.

import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';
import { haptic } from '@/components/app/job-cards';

interface Who {
  id: string;
  email: string;
}

const INPUT_CLS =
  'mt-2 block w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 font-jost text-[15px] text-ink placeholder-ink-3 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/20';

export default function DeleteAccountRoom() {
  const router = useRouter();
  const [who, setWho] = useState<Who | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server's named blockers (409) — rendered as a list, honestly, each
  // naming the action that clears it. Nothing has been deactivated when these show.
  const [blockers, setBlockers] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/profile')
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401 || r.status === 403) {
          setLoadState('denied');
          return;
        }
        const d = r.ok ? await r.json().catch(() => null) : null;
        if (!d?.id || !d?.email) {
          setLoadState('error');
          return;
        }
        setWho({ id: d.id, email: d.email });
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = !!who && confirmText === 'DELETE' && password.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit || !who) return;
    haptic('medium');
    setSubmitting(true);
    setError(null);
    setBlockers(null);
    try {
      const res = await fetch('/api/gdpr/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: who.id, email: who.email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data?.blockers) && data.blockers.length > 0) {
          setBlockers(data.blockers as string[]);
        } else {
          setError(data?.error || 'Could not submit the deletion request. Please try again.');
        }
        haptic('error');
        setSubmitting(false);
        return;
      }
      // DEACTIVATED now. End the web session; the shell sees /en/login as
      // session-lost and drops to its native login screen (which refuses the
      // account from here on).
      await signOut({ callbackUrl: '/en/login' });
    } catch {
      setError('Network error. Please try again.');
      haptic('error');
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="delete-account-room">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface"
          data-testid="delete-account-back"
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Your account
          </p>
          <h1 className="font-jost text-[22px] font-semibold leading-tight text-ink">
            Delete my account
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AccountMenu />
          <InboxBell />
        </div>
      </header>

      {loadState === 'denied' && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 font-jost text-[14px] text-ink-2">
          Please sign in again to manage your account.
        </p>
      )}
      {loadState === 'error' && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 font-jost text-[14px] text-ink-2">
          We couldn&rsquo;t load your account just now. Please try again in a moment.
        </p>
      )}

      {(loadState === 'loading' || loadState === 'ready') && (
        <>
          {/* What happens — the two-stage truth, cleaner-specific. */}
          <section className="rounded-2xl border border-line bg-surface px-4 py-4">
            <h2 className="font-jost text-[15px] font-semibold text-ink">What happens</h2>
            <ul className="mt-2 space-y-2 font-jost text-[13px] leading-relaxed text-ink-2">
              <li>
                <strong className="font-medium text-ink">Your account closes straight away.</strong>{' '}
                You are signed out of Rena Pro and the website, and the account can no longer be
                used. This cannot be undone.
              </li>
              <li>
                <strong className="font-medium text-ink">Your data is erased within 30 days</strong>{' '}
                after a final check: your profile, photos, bio, availability, contact details and
                the messages you sent (redacted, so your customers&rsquo; threads still make sense).
              </li>
              <li>
                <strong className="font-medium text-ink">Nothing mid-job or unpaid.</strong> If you
                have upcoming or in-progress cleans, an active regular clean, a payout still on its
                way to you, an open dispute or a pending payment adjustment, we will ask you to
                finish or settle those first and tell you exactly which.
              </li>
              <li>
                <strong className="font-medium text-ink">Your Stripe account stays yours.</strong>{' '}
                Rena disconnects it from your profile at erasure. We never delete it at Stripe, and
                any payout already released is unaffected.
              </li>
              <li>
                <strong className="font-medium text-ink">Your documents.</strong> Photo ID, selfie
                and insurance files are destroyed at erasure. Your right to work record is kept for
                the length of your engagement plus 2 years, as UK law requires, and your DBS
                certificate number and issue date are kept under the same statutory hold. Booking
                and payment records are kept for 6 years for HMRC.
              </li>
            </ul>
          </section>

          {blockers && (
            <section
              className="mt-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-4"
              data-testid="delete-account-blockers"
            >
              <h2 className="font-jost text-[15px] font-semibold text-danger">
                Your account can&rsquo;t be deleted yet
              </h2>
              <p className="mt-1 font-jost text-[13px] text-ink-2">
                Nothing has changed on your account. Clear these first, then come back:
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 font-jost text-[13px] text-ink">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4">
            <label className="block">
              <span className="font-jost text-[13px] text-ink-2">
                Type <span className="font-mono font-bold text-danger">DELETE</span> to confirm
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoCapitalize="characters"
                autoCorrect="off"
                className={INPUT_CLS}
                data-testid="delete-account-confirm"
              />
            </label>
            <label className="mt-4 block">
              <span className="font-jost text-[13px] text-ink-2">Re-enter your password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className={INPUT_CLS}
                data-testid="delete-account-password"
              />
            </label>
            {error && (
              <p
                className="mt-3 rounded-[10px] border border-danger/20 bg-danger/10 px-3 py-2.5 font-jost text-[13px] text-danger"
                data-testid="delete-account-error"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="mt-5 w-full rounded-[10px] bg-danger py-3 font-jost text-sm font-medium text-white active:opacity-90 disabled:opacity-50"
              data-testid="delete-account-submit"
            >
              {submitting ? 'Submitting…' : 'Deactivate & request erasure'}
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                router.back();
              }}
              disabled={submitting}
              className="mt-1 w-full py-3 font-jost text-sm font-medium text-ink-2 active:opacity-70 disabled:opacity-60"
            >
              Cancel
            </button>
          </section>
        </>
      )}
    </div>
  );
}
