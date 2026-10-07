'use client';

import Link from 'next/link';

import type { LoadFailure } from '@/lib/load-state';

// RENA-019 (B2b): the honest failure card for the customer app's panes. A
// failure is never shown as an empty state; each kind has its own words and
// its own door. 'unauthorised' never renders here (the page runs the R6 belt
// to /login instead). Strings stay in the component (RENA-086's rule).
const COPY: Record<Exclude<LoadFailure, 'unauthorised'>, { title: string; body: string }> = {
  offline: {
    title: 'You’re Offline',
    body: 'Check your connection, then try again.',
  },
  forbidden: {
    title: 'Can’t Open This Here',
    body: 'Your account can’t see this right now. If that seems wrong, contact Rena.',
  },
  error: {
    title: 'Couldn’t Load This',
    body: 'Something went wrong on our side. Try again in a moment.',
  },
};

export default function PaneLoadFailure({
  failure,
  onRetry,
  testId,
}: {
  failure: Exclude<LoadFailure, 'unauthorised'>;
  onRetry: () => void;
  testId?: string;
}) {
  const copy = COPY[failure];
  return (
    <div
      className="rounded-xl border border-line bg-surface px-6 py-8 text-center"
      data-testid={testId ?? 'pane-failure'}
      data-kind={failure}
      role="status"
    >
      <p className="font-jost text-[17px] font-semibold text-ink">{copy.title}</p>
      <p className="mx-auto mt-1.5 max-w-[260px] font-jost text-[13px] leading-snug text-ink-3">
        {copy.body}
      </p>
      {failure === 'forbidden' ? (
        <Link
          href="/contact"
          data-testid="pane-failure-contact"
          className="mt-5 inline-flex rounded-[10px] border border-line px-7 py-3 font-jost text-[12px] font-semibold uppercase tracking-[0.12em] text-ink active:bg-page"
        >
          Contact Rena
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          data-testid="pane-failure-retry"
          className="mt-5 inline-flex rounded-[10px] bg-primary px-7 py-3 font-jost text-[12px] font-semibold uppercase tracking-[0.12em] text-white active:opacity-90"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
