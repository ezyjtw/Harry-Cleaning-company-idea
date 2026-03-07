"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl">&#128268;</span>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        You&apos;re Offline
      </h1>
      <p className="mt-3 max-w-md text-gray-600">
        It looks like you&apos;ve lost your internet connection. Please check
        your connection and try again.
      </p>
      <button
        onClick={() => (typeof window !== "undefined" ? window.location.reload() : null)}
        className="mt-6 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Try Again
      </button>
    </div>
  );
}
