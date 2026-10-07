'use client';

// UGC report sheet (James-ordered, Apple 1.2): one reason tap, an optional
// note, one send. Used for a review and for a whole conversation. Dressed in
// the shells' sheet grammar (the decline sheet) and acceptable in the browser
// as the same bottom sheet. Honest copy: the report goes to Rena only; the
// person reported is not told who reported.

import Link from 'next/link';
import { useState } from 'react';

import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@/lib/reports';

interface Props {
  target: ReportTarget;
  reviewId?: string;
  partnerId?: string;
  /** What is being reported, for the title: "this review" / "this conversation". */
  onClose: () => void;
  onReported?: () => void;
}

export default function ReportSheet({ target, reviewId, partnerId, onClose, onReported }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [done, setDone] = useState(false);

  const noun = target === 'REVIEW' ? 'review' : 'conversation';

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          reviewId,
          partnerId,
          reason,
          details: details.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'That did not send. Please try again.');
        return;
      }
      setDone(true);
      onReported?.();
    } catch {
      setError('That did not send. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Report this ${noun}`}
      data-testid="report-sheet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <p className="font-jost text-lg font-semibold text-ink">Thank you</p>
            <p className="mt-1 font-jost text-[13px] text-ink-3">
              Rena will look at this {noun}. The other person is not told who reported it.
            </p>
            <button
              type="button"
              onClick={onClose}
              data-testid="report-done"
              className="mt-4 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold uppercase tracking-[0.1em] text-white active:opacity-80"
            >
              Done
            </button>
          </>
        ) : needsLogin ? (
          <>
            <p className="font-jost text-lg font-semibold text-ink">Sign in to report</p>
            <p className="mt-1 font-jost text-[13px] text-ink-3">
              Reports come from signed-in accounts so Rena can follow up with you.
            </p>
            <Link
              href="/login"
              className="mt-4 block w-full rounded-[12px] bg-primary px-4 py-3 text-center font-jost text-sm font-semibold uppercase tracking-[0.1em] text-white active:opacity-80"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-ink-3"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <p className="font-jost text-lg font-semibold text-ink">Report this {noun}</p>
            <p className="mt-0.5 font-jost text-[13px] text-ink-3">
              Tell Rena what is wrong. Only Rena sees this.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {REPORT_REASONS[target].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => setReason(value)}
                  data-testid={`report-reason-${value}`}
                  aria-pressed={reason === value}
                  className={`rounded-[12px] border px-4 py-3 text-left font-jost text-sm font-medium shadow-sm active:bg-page disabled:opacity-50 ${
                    reason === value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-line bg-surface text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Anything else Rena should know (optional)"
              data-testid="report-details"
              className="mt-3 w-full rounded-[12px] border border-line bg-surface px-3 py-2 font-jost text-sm text-ink placeholder-ink-3"
            />
            {error && (
              <p
                role="alert"
                className="mt-2 font-jost text-[13px] text-danger"
                data-testid="report-error"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!reason || busy}
              data-testid="report-send"
              className="mt-3 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold uppercase tracking-[0.1em] text-white active:opacity-80 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-2 w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-ink-3"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
