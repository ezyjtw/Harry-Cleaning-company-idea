'use client';

// The Pro shell's standing back chevron (ROUND 4 lane 1): the round pill the
// profile and contact screens already wear, extracted so every non-root screen
// carries the same one. history-back semantics — the pill returns you to
// wherever you came from within the tab's own pane.

import { useRouter } from 'next/navigation';

import { haptic } from '@/components/app/job-cards';

export default function BackPill({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      data-testid="back-pill"
      onClick={() => {
        haptic('light');
        router.back();
      }}
      className={`rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page ${className || ''}`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}
