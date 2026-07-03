'use client';

import { useEffect } from 'react';

// Route-level error boundary for /messages. App Router renders this (a Client
// Component) instead of a blank screen when the messages page/segment THROWS
// DURING RENDER — e.g. an unexpected data shape from the API. It degrades to a
// friendly retry state rather than white-screening.
//
// NOTE: this cannot save an app-down/502 (no server -> no React -> no boundary);
// it's preventive for render-time failures, not infra outages.
export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[messages] render error:', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
        <svg
          className="h-8 w-8 text-danger"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h2 className="font-newsreader text-xl font-semibold text-ink">
        Couldn&rsquo;t load your messages
      </h2>
      <p className="mt-1 max-w-sm text-sm text-ink-2">
        Something went wrong loading this page. Please try again — if it keeps happening, contact
        support.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
