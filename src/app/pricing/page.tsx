import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — Transparent Cleaning Rates | Rena',
  description:
    'See exactly what you pay with Rena. Our 10% platform fee is lower than the industry standard. No hidden fees, no surprises — just honest, transparent pricing.',
  openGraph: {
    title: 'Pricing — Transparent Cleaning Rates | Rena',
    description:
      'See exactly what you pay with Rena. Our 10% platform fee is lower than the industry standard.',
  },
};

const serviceRates = [
  {
    type: 'Regular Cleaning',
    description: 'Weekly or fortnightly recurring cleans',
    rate: '£12 – £20/hr',
    typical: '2–4 hours',
  },
  {
    type: 'One-Off Cleaning',
    description: 'Single booking for a thorough clean',
    rate: '£14 – £22/hr',
    typical: '3–5 hours',
  },
  {
    type: 'Deep Cleaning',
    description: 'Intensive top-to-bottom cleaning',
    rate: '£18 – £30/hr',
    typical: '4–8 hours',
  },
  {
    type: 'End of Tenancy',
    description: 'Comprehensive move-out clean',
    rate: '£20 – £35/hr',
    typical: '5–10 hours',
  },
  {
    type: 'Same-Day Cleaning',
    description: 'Urgent booking for same-day service',
    rate: '£18 – £28/hr',
    typical: '2–4 hours',
  },
  {
    type: 'Airbnb / Short-Let',
    description: 'Turnaround cleaning between guests',
    rate: '£15 – £25/hr',
    typical: '2–4 hours',
  },
];

const comparisonFeatures = [
  { feature: 'Platform commission', rena: '10%', competitor1: '20%', competitor2: '25–30%' },
  { feature: 'Choose your cleaner', rena: 'Yes', competitor1: 'Limited', competitor2: 'No' },
  { feature: 'Transparent pricing', rena: 'Yes', competitor1: 'Partial', competitor2: 'No' },
  { feature: 'Escrow protection', rena: 'Yes', competitor1: 'No', competitor2: 'No' },
  { feature: 'Satisfaction guarantee', rena: 'Yes', competitor1: 'Limited', competitor2: 'Yes' },
  { feature: 'Verified reviews', rena: 'Yes', competitor1: 'Yes', competitor2: 'Partial' },
  { feature: 'Same-day booking', rena: 'Yes', competitor1: 'Yes', competitor2: 'No' },
  { feature: 'No subscription required', rena: 'Yes', competitor1: 'No', competitor2: 'Yes' },
];

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-ink py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-light tracking-tight text-cream font-cormorant sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-jost font-light text-cream/80">
            No hidden fees, no subscription traps. You see the full price before you book, and
            cleaners keep 90% of what you pay.
          </p>
        </div>
      </section>

      {/* How pricing works */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">How Our Pricing Works</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 text-lg font-jost font-light text-ink-2 leading-relaxed">
            Cleaners set their own hourly rates based on their experience, specialisations, and
            location. Rena adds a 10% platform fee on top — this covers payment processing, customer
            support, insurance verification, and platform maintenance.
          </p>

          {/* Price breakdown example */}
          <div
            className="mt-10 bg-cream-2 p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <h3 className="text-lg font-normal text-ink font-cormorant">Example Price Breakdown</h3>
            <p className="mt-1 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              3-hour regular clean at £15/hr
            </p>
            <div className="mt-6 space-y-4">
              <div
                className="flex items-center justify-between pb-3"
                style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <span className="font-jost font-light text-ink-2">
                  Cleaner earnings (3 hrs x £15)
                </span>
                <span className="font-normal text-ink font-jost">£45.00</span>
              </div>
              <div
                className="flex items-center justify-between pb-3"
                style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <span className="font-jost font-light text-ink-2">Platform fee (10%)</span>
                <span className="font-normal text-ink font-jost">£4.50</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-normal text-ink font-cormorant">Total you pay</span>
                <span className="text-lg font-normal text-gold font-cormorant">£49.50</span>
              </div>
            </div>
            <p className="mt-6 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              The cleaner receives £45.00 directly. Rena keeps £4.50 to run the platform.
            </p>
          </div>
        </div>
      </section>

      {/* Service rates */}
      <section className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">
            Typical Rates by Service Type
          </h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 font-jost font-light text-ink-2">
            Rates vary by cleaner and location. Below are typical ranges across the platform.
          </p>
          <div
            className="mt-10 overflow-hidden bg-cream"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <table className="min-w-full">
              <thead className="bg-cream-2">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                  >
                    Service Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                  >
                    Hourly Rate
                  </th>
                  <th
                    scope="col"
                    className="hidden px-6 py-4 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal sm:table-cell"
                  >
                    Typical Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {serviceRates.map((service) => (
                  <tr key={service.type} style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-normal text-ink font-jost">{service.type}</div>
                      <div className="text-sm font-jost font-light text-ink-3">
                        {service.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-normal text-gold font-jost">
                      {service.rate}
                    </td>
                    <td className="hidden px-6 py-4 text-sm font-jost font-light text-ink-2 sm:table-cell">
                      {service.typical}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            * Rates shown exclude the 10% platform fee. The total price including the fee is always
            displayed before you confirm a booking.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">Rena vs. Competitors</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 font-jost font-light text-ink-2">
            See how we stack up against traditional cleaning agencies and other platforms.
          </p>
          <div
            className="mt-10 overflow-x-auto bg-cream-2"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                  >
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center font-jost text-[11px] uppercase tracking-[0.1em] text-gold font-normal"
                  >
                    Rena
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                  >
                    Platform A
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                  >
                    Agencies
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
                  <tr key={row.feature} style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}>
                    <td className="px-6 py-4 text-sm font-jost text-ink">{row.feature}</td>
                    <td className="px-6 py-4 text-center text-sm font-normal text-gold font-jost">
                      {row.rena}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-jost font-light text-ink-3">
                      {row.competitor1}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-jost font-light text-ink-3">
                      {row.competitor2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* No hidden fees */}
      <section className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div
            className="bg-cream p-8 sm:p-12"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="#b8975a"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-light text-ink font-cormorant">
                Our No Hidden Fees Guarantee
              </h2>
              <div className="mx-auto mt-4 w-8 h-px bg-gold" />
              <p className="mx-auto mt-4 max-w-2xl text-lg font-jost font-light text-ink-2">
                The price you see at checkout is the price you pay. We will never add surprise
                charges, service fees, or booking fees. Our 10% platform fee is the only charge we
                make, and it is always included in the total shown to you.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/cleaners"
                  className="inline-block bg-ink px-8 py-3 font-jost font-light text-cream text-sm uppercase tracking-[0.1em] transition-colors hover:bg-ink/90"
                >
                  Browse Cleaners
                </Link>
                <Link
                  href="/guarantees"
                  className="inline-block px-8 py-3 font-jost font-light text-ink text-sm uppercase tracking-[0.1em] transition-colors hover:bg-cream-2"
                  style={{ border: '0.5px solid #0e0e0c' }}
                >
                  View All Guarantees
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
