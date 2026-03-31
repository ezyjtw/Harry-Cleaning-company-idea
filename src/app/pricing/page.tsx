import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing — Transparent Cleaning Rates | Rena',
  description:
    'See exactly what you pay with Rena. Cleaner rates are listed upfront with just a 6% service fee at checkout. No hidden fees, no surprises.',
  openGraph: {
    title: 'Pricing — Transparent Cleaning Rates | Rena',
    description:
      'See exactly what you pay with Rena. Cleaner rates listed upfront with just a 6% service fee.',
  },
};

const serviceRates = [
  {
    type: 'Regular Cleaning',
    description: 'Weekly or fortnightly recurring cleans',
    rate: '\u00A314 \u2013 \u00A335/hr',
    typical: '2\u20134 hours',
  },
  {
    type: 'One-Off Cleaning',
    description: 'Single visit, no recurring commitment',
    rate: '\u00A315 \u2013 \u00A339/hr',
    typical: '2\u20134 hours',
  },
  {
    type: 'Deep Cleaning',
    description: 'Intensive top-to-bottom cleaning',
    rate: '\u00A320 \u2013 \u00A351/hr',
    typical: '3\u20138 hours',
  },
  {
    type: 'End of Tenancy',
    description: 'Fixed price by property size',
    rate: '\u00A3150 \u2013 \u00A3580',
    typical: 'Fixed by property size',
  },
  {
    type: 'Airbnb / Short-Let',
    description: 'Fixed price turnaround between guests',
    rate: '\u00A345 \u2013 \u00A3165',
    typical: 'Fixed by property size',
  },
  {
    type: 'Same-Day Cleaning',
    description: 'Urgent booking for same-day service',
    rate: '\u00A318 \u2013 \u00A346/hr',
    typical: '2\u20134 hours',
  },
];

const comparisonFeatures = [
  { feature: 'Service fee', rena: '6%', competitor1: 'Hidden', competitor2: '10\u201316%' },
  { feature: 'Choose your cleaner', rena: 'Yes', competitor1: 'Limited', competitor2: 'No' },
  { feature: 'Transparent pricing', rena: 'Yes', competitor1: 'Partial', competitor2: 'No' },
  { feature: 'Escrow protection', rena: 'Yes', competitor1: 'No', competitor2: 'No' },
  { feature: 'Satisfaction guarantee', rena: 'Yes', competitor1: 'Limited', competitor2: 'Yes' },
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
            No hidden fees, no subscription traps. Each cleaner sets their own rate and you see the
            full price before you book. We add just a small 6% service fee at checkout.
          </p>
        </div>
      </section>

      {/* How pricing works */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">How Our Pricing Works</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 text-lg font-jost font-light text-ink-2 leading-relaxed">
            Every cleaner on Rena sets their own hourly rate. You browse, compare, and pick the
            cleaner that suits you. The only extra charge is a small 6% service fee added at
            checkout.
          </p>
          <div
            className="mt-6 bg-cream-2 p-6 sm:p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="#b8975a"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-cormorant text-xl font-light text-ink">6% Service Fee</p>
                <p className="mt-2 font-jost text-sm font-light text-ink-2">
                  This covers customer support, our satisfaction guarantee, escrow payment
                  protection, and platform maintenance. It&apos;s always shown before you confirm
                  your booking — no surprises.
                </p>
              </div>
            </div>
          </div>

          {/* Price breakdown example */}
          <div
            className="mt-10 bg-cream-2 p-8"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <h3 className="text-lg font-normal text-ink font-cormorant">Example Price Breakdown</h3>
            <p className="mt-1 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              3-hour regular clean at &pound;16.50/hr
            </p>
            <div className="mt-6 space-y-4">
              <div
                className="flex items-center justify-between pb-3"
                style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <span className="font-jost font-light text-ink-2">
                  Cleaning (3 hrs &times; &pound;16.50)
                </span>
                <span className="font-normal text-ink font-jost">&pound;49.50</span>
              </div>
              <div
                className="flex items-center justify-between pb-3"
                style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <span className="font-jost font-light text-ink-2">Service fee (6% of total)</span>
                <span className="font-normal text-ink font-jost">&pound;3.16</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-normal text-ink font-cormorant">Total you pay</span>
                <span className="text-lg font-normal text-gold font-cormorant">&pound;52.66</span>
              </div>
            </div>
            <p className="mt-6 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              What you see at checkout is what you pay. No hidden extras.
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
            Specialist services like end-of-tenancy and Airbnb have higher rates to reflect the
            additional work involved.
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
                    Rate
                  </th>
                  <th
                    scope="col"
                    className="hidden px-6 py-4 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal sm:table-cell"
                  >
                    Pricing Model
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
            * Rates shown are listed cleaner rates. A 6% service fee is added at checkout and always
            displayed before you confirm.
          </p>
        </div>
      </section>

      {/* Airbnb & End of Tenancy explainer */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">Specialist Services</h2>
          <div className="mt-4 w-8 h-px bg-gold" />

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* Airbnb */}
            <div
              className="bg-cream-2 p-6 sm:p-8"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                Short-Let Hosts
              </p>
              <h3 className="mt-2 font-cormorant text-xl font-light text-ink">
                Airbnb &amp; Holiday Let Cleaning
              </h3>
              <p className="mt-3 font-jost text-sm font-light text-ink-2 leading-relaxed">
                Prices are set by each cleaner. Typical rates on Rena range from &pound;45 for a
                studio to &pound;165 for a 4-bedroom property. A 6% service fee is added at
                checkout. Choose your cleaner to see their exact price.
              </p>
              <div
                className="mt-4 bg-cream p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Typical range
                </p>
                <p className="mt-1 font-jost text-sm font-light text-ink-2">
                  <span className="font-normal text-ink">&pound;45 &ndash; &pound;165</span> + 6%
                  service fee
                </p>
              </div>
            </div>

            {/* End of Tenancy */}
            <div
              className="bg-cream-2 p-6 sm:p-8"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                Tenants &amp; Landlords
              </p>
              <h3 className="mt-2 font-cormorant text-xl font-light text-ink">
                End of Tenancy Cleaning
              </h3>
              <p className="mt-3 font-jost text-sm font-light text-ink-2 leading-relaxed">
                Prices are set by each cleaner. Typical rates on Rena range from &pound;150 for a
                studio to &pound;580 for a 5-bedroom property. A 6% service fee is added at
                checkout. Choose your cleaner to see their exact price.
              </p>
              <div
                className="mt-5 overflow-hidden bg-cream"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <table className="min-w-full">
                  <thead className="bg-cream-2">
                    <tr>
                      <th className="px-4 py-3 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                        Property Size
                      </th>
                      <th className="px-4 py-3 text-right font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                        Typical Range
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Studio', range: '£150 – £200' },
                      { label: '1 Bed', range: '£190 – £240' },
                      { label: '2 Bed', range: '£250 – £300' },
                      { label: '3 Bed', range: '£320 – £380' },
                      { label: '4 Bed', range: '£390 – £450' },
                      { label: '5+ Bed', range: '£480 – £580' },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}>
                        <td className="px-4 py-3 font-jost text-sm font-light text-ink">
                          {row.label}
                        </td>
                        <td className="px-4 py-3 text-right font-jost text-sm font-normal text-gold">
                          {row.range}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-jost text-xs font-light text-ink-3">
                Prices shown are typical cleaner rates. A 6% service fee is added at checkout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-light text-ink font-cormorant">
            Rena vs. Leading Platforms in the Industry
          </h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 font-jost font-light text-ink-2">
            See how we stack up against leading platforms in the industry.
          </p>
          <div
            className="mt-10 overflow-x-auto bg-cream"
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
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div
            className="bg-cream-2 p-8 sm:p-12"
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
                The price you see at checkout is the price you pay. A 6% service fee is the only
                charge we add, and it&apos;s always shown before you confirm a booking.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/services"
                  className="inline-block bg-ink px-8 py-3 font-jost font-light text-cream text-sm uppercase tracking-[0.1em] transition-colors hover:bg-ink/90"
                >
                  Browse Cleaners
                </Link>
                <Link
                  href="/guarantees"
                  className="inline-block px-8 py-3 font-jost font-light text-ink text-sm uppercase tracking-[0.1em] transition-colors hover:bg-cream"
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
