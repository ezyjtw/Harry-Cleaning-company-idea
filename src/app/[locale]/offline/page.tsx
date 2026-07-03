'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl">&#128268;</span>
      <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">You&apos;re Offline</h1>
      <p className="mt-3 max-w-md text-ink-2">
        It looks like you&apos;ve lost your internet connection. Please check your connection and
        try again.
      </p>
      <button
        onClick={() => (typeof window !== 'undefined' ? window.location.reload() : null)}
        className="mt-6 rounded-[10px] bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        Try Again
      </button>
    </div>
  );
}
