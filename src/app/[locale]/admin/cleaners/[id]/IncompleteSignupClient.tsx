'use client';

// F28: dossier for an INCOMPLETE cleaner signup — a step-0 account with no
// CleanerProfile. The list links every row; this view guarantees no
// Remove-only rows: if the list shows a person, an admin can see their state.

import Link from 'next/link';
import { useState } from 'react';

import type { IncompleteSignupDetail } from './page';

// Same labels as the /join wizard's stepper (STEPS there) — index-aligned.
const WIZARD_STEPS = [
  'Personal',
  'Experience',
  'Pricing',
  'Identity',
  'DBS Check',
  'Terms',
  'Review',
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function IncompleteSignupClient({ signup }: { signup: IncompleteSignupDetail }) {
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function resendVerification() {
    setResending(true);
    setResendResult(null);
    try {
      const res = await fetch(
        `/api/admin/cleaners/incomplete/${signup.userId}/resend-verification`,
        {
          method: 'POST',
        }
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendResult({ ok: true, text: `Verification email re-sent to ${signup.email}.` });
      } else {
        setResendResult({ ok: false, text: d.error || 'Could not resend the email.' });
      }
    } catch {
      setResendResult({ ok: false, text: 'Network error — please try again.' });
    } finally {
      setResending(false);
    }
  }

  const tokenLive = signup.verifyTokenExpires
    ? new Date(signup.verifyTokenExpires).getTime() > Date.now()
    : false;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto" data-testid="incomplete-signup-view">
      <Link
        href="/admin/cleaners"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-2 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to cleaners
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-ink">{signup.name}</h1>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Signup incomplete
        </span>
        {signup.isSuspended && (
          <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
            Suspended
          </span>
        )}
      </div>
      <p className="text-sm text-ink-3 mb-6">
        Started the cleaner signup wizard but never submitted — there is no cleaner profile yet.
        This account is removed automatically on {formatDate(signup.sweepAt)} if the signup stays
        unfinished.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account state */}
        <div className="bg-surface rounded-xl border border-line p-6">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Email</dt>
              <dd className="text-ink text-right break-all">{signup.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Email verified</dt>
              <dd className="text-right">
                {signup.emailVerified ? (
                  <span className="text-trust">✓ {formatDateTime(signup.emailVerified)}</span>
                ) : (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                    Not verified
                  </span>
                )}
              </dd>
            </div>
            {!signup.emailVerified && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Verification link</dt>
                <dd className="text-right text-ink-2">
                  {signup.verifyTokenExpires
                    ? tokenLive
                      ? `Live until ${formatDateTime(signup.verifyTokenExpires)}`
                      : `Expired ${formatDateTime(signup.verifyTokenExpires)}`
                    : 'None on record'}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Phone</dt>
              <dd className="text-ink text-right">{signup.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Account created</dt>
              <dd className="text-ink text-right">{formatDateTime(signup.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Account status</dt>
              <dd className="text-ink text-right">{signup.accountStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Auto-removal</dt>
              <dd className="text-ink text-right">{formatDate(signup.sweepAt)} (30-day sweep)</dd>
            </div>
          </dl>

          {!signup.emailVerified && (
            <div className="mt-5 border-t border-line pt-4">
              <button
                type="button"
                data-testid="resend-verification"
                disabled={resending}
                onClick={resendVerification}
                className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendResult && (
                <p
                  data-testid="resend-result"
                  className={`mt-2 font-jost text-sm ${resendResult.ok ? 'text-trust' : 'text-danger'}`}
                >
                  {resendResult.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Wizard progress */}
        <div className="bg-surface rounded-xl border border-line p-6">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wider mb-4">
            Wizard progress
          </h2>
          <ol className="space-y-2 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-ink">
                <span className="text-trust mr-1.5">✓</span>Step 1 · Personal — account created
              </span>
              <span className="text-ink-3">{formatDateTime(signup.createdAt)}</span>
            </li>
            {signup.funnel.steps.map((s) => (
              <li key={s.stepIndex} className="flex justify-between gap-4">
                <span className="text-ink">
                  <span className="text-primary mr-1.5">→</span>
                  Step {s.stepIndex + 1} · {WIZARD_STEPS[s.stepIndex] || s.stepName} — reached
                </span>
                <span className="text-ink-3">{formatDateTime(s.firstAt)}</span>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-sm text-ink-2">
            {signup.funnel.furthestStepIndex !== null ? (
              <>
                Furthest step reached:{' '}
                <span className="font-medium text-ink">
                  {WIZARD_STEPS[signup.funnel.furthestStepIndex]} (step{' '}
                  {signup.funnel.furthestStepIndex + 1} of {WIZARD_STEPS.length})
                </span>
                {signup.funnel.lastActivityAt && (
                  <> · last activity {formatDateTime(signup.funnel.lastActivityAt)}</>
                )}
              </>
            ) : (
              'No analytics trail matched this account — progress beyond account creation is unknown. (The wizard saves later steps only in the visitor’s browser; the server learns more only from anonymous funnel events.)'
            )}
          </p>
          {signup.funnel.matchedSessions > 1 && (
            <p className="mt-2 text-xs text-ink-3">
              Matched {signup.funnel.matchedSessions} overlapping signup sessions — the trail above
              is best-effort, not exact.
            </p>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-1">
              Documents
            </h3>
            <p className="text-sm text-ink-2">
              None — documents are uploaded at the final Review step, which was never reached.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
