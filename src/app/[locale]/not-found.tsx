import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-md">
        {/* 404 illustration */}
        <div className="mb-6">
          <span className="font-newsreader text-8xl font-semibold text-primary">404</span>
        </div>

        <h1 className="mb-2 font-newsreader text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mb-6 text-ink-2">
          Sorry, we could not find the page you are looking for. It may have been moved or no longer
          exists.
        </p>

        {/* Search suggestion */}
        <div className="mb-8 rounded-[10px] border border-line bg-page p-4 text-left">
          <p className="text-sm font-medium text-ink-2">Here are some suggestions:</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            <li className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              Try searching for a cleaner in your area
            </li>
            <li className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
              Browse our available services
            </li>
            <li className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                />
              </svg>
              Check out our how it works page
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
          >
            Go to home page
          </Link>
          <Link
            href="/cleaners"
            className="inline-flex items-center justify-center rounded-[10px] border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink-2 transition hover:bg-page focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2"
          >
            Find a cleaner
          </Link>
        </div>
      </div>
    </div>
  );
}
