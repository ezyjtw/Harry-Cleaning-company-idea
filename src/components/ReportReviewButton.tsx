'use client';

// The Report door on a review card (every surface that renders a Rena review:
// the cleaner profile in the browser and in the customer shell, the cleaner's
// own Reviews room). Quiet text door; the sheet does the rest. Reporting
// never changes what the review shows or when it was published.

import { useState } from 'react';

import ReportSheet from '@/components/ReportSheet';

export default function ReportReviewButton({
  reviewId,
  className = '',
}: {
  reviewId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);

  return (
    <>
      {reported ? (
        <span
          className={`font-jost text-[11px] text-ink-3 ${className}`}
          data-testid="review-reported"
        >
          Reported
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="review-report"
          aria-label="Report this review"
          className={`font-jost text-[11px] text-ink-3 underline-offset-2 hover:underline active:text-danger ${className}`}
        >
          Report
        </button>
      )}
      {/* The sheet stays up through its own Thank you until Done; the card
          flips to Reported underneath it. */}
      {open && (
        <ReportSheet
          target="REVIEW"
          reviewId={reviewId}
          onClose={() => setOpen(false)}
          onReported={() => setReported(true)}
        />
      )}
    </>
  );
}
