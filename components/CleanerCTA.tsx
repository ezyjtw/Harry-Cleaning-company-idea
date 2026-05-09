import Link from 'next/link';

export default function CleanerCTA() {
  return (
    <section className="bg-ink px-5 py-16 md:px-14 md:py-24">
      <div className="mx-auto max-w-5xl md:flex md:items-center md:justify-between md:gap-12">
        <div className="md:flex-1">
          <p className="font-jost text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
            Join our network
          </p>
          <h2 className="mt-3 font-cormorant text-[32px] font-light leading-tight text-cream md:text-[44px]">
            Earn on your terms as a Rena cleaner
          </h2>
          <p className="mt-4 max-w-lg font-jost text-[15px] font-light leading-relaxed text-cream/70">
            Set your own hours, choose your rates, and build your client base. Rena handles the
            bookings, payments, and insurance — you focus on what you do best.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {[
              'Set your own rates',
              'Flexible schedule',
              'Weekly payouts',
              'Full insurance cover',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-gold"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-jost text-[13px] font-light text-cream/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 md:mt-0 md:shrink-0">
          <Link
            href="/join"
            className="inline-block rounded-md bg-gold px-10 py-4 font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Apply to become a cleaner
          </Link>
          <p className="mt-3 font-jost text-[12px] font-light text-cream/50">
            Free to join &middot; Start earning this week
          </p>
        </div>
      </div>
    </section>
  );
}
