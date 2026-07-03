import Link from 'next/link';

export default function SameDayComingSoonBanner() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <div
        className="rounded-xl bg-white px-6 py-10 text-center shadow-sm"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <svg className="h-7 w-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="font-newsreader text-2xl font-semibold text-ink sm:text-3xl">
          Same-day cleaning is coming soon
        </h1>
        <p className="mx-auto mt-3 max-w-md font-jost text-sm font-light text-ink-3">
          We&apos;re onboarding more cleaners so we can guarantee same-day availability in your
          area. In the meantime, you can book a regular clean for as early as tomorrow.
        </p>
        <Link
          href="/services/regular"
          className="mt-6 inline-block rounded-full bg-ink px-8 py-3 font-jost text-[12px] uppercase tracking-[0.12em] text-cream shadow-sm hover:bg-gold hover:shadow-md transition-all"
        >
          Browse other services
        </Link>
      </div>
    </div>
  );
}
