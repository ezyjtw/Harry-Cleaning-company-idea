import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Transparent Cleaning Rates | Rena',
  description:
    'See exactly what you pay with Rena. Our 10% platform fee is lower than the industry standard. No hidden fees, no surprises — just honest, transparent pricing.',
  openGraph: {
    title: 'Pricing — Transparent Cleaning Rates | Rena',
    description:
      'See exactly what you pay with Rena. Our 10% platform fee is lower than the industry standard.',
  },
}

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
]

const comparisonFeatures = [
  { feature: 'Platform commission', rena: '10%', competitor1: '20%', competitor2: '25–30%' },
  { feature: 'Choose your cleaner', rena: 'Yes', competitor1: 'Limited', competitor2: 'No' },
  { feature: 'Transparent pricing', rena: 'Yes', competitor1: 'Partial', competitor2: 'No' },
  { feature: 'Escrow protection', rena: 'Yes', competitor1: 'No', competitor2: 'No' },
  { feature: 'Satisfaction guarantee', rena: 'Yes', competitor1: 'Limited', competitor2: 'Yes' },
  { feature: 'Verified reviews', rena: 'Yes', competitor1: 'Yes', competitor2: 'Partial' },
  { feature: 'Same-day booking', rena: 'Yes', competitor1: 'Yes', competitor2: 'No' },
  { feature: 'No subscription required', rena: 'Yes', competitor1: 'No', competitor2: 'Yes' },
]

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-600 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90">
            No hidden fees, no subscription traps. You see the full price before
            you book, and cleaners keep 90% of what you pay.
          </p>
        </div>
      </section>

      {/* How pricing works */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">
            How Our Pricing Works
          </h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Cleaners set their own hourly rates based on their experience,
            specialisations, and location. Rena adds a 10% platform fee on top —
            this covers payment processing, customer support, insurance
            verification, and platform maintenance.
          </p>

          {/* Price breakdown example */}
          <div className="mt-10 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900">
              Example Price Breakdown
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              3-hour regular clean at £15/hr
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-600">
                  Cleaner earnings (3 hrs x £15)
                </span>
                <span className="font-semibold text-gray-900">£45.00</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-600">Platform fee (10%)</span>
                <span className="font-semibold text-gray-900">£4.50</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-bold text-gray-900">
                  Total you pay
                </span>
                <span className="text-lg font-bold text-brand-600">
                  £49.50
                </span>
              </div>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              The cleaner receives £45.00 directly. Rena keeps £4.50 to run the
              platform.
            </p>
          </div>
        </div>
      </section>

      {/* Service rates */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Typical Rates by Service Type
          </h2>
          <p className="mt-4 text-gray-600">
            Rates vary by cleaner and location. Below are typical ranges across
            the platform.
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-gray-900"
                  >
                    Service Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-gray-900"
                  >
                    Hourly Rate
                  </th>
                  <th
                    scope="col"
                    className="hidden px-6 py-4 text-left text-sm font-semibold text-gray-900 sm:table-cell"
                  >
                    Typical Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {serviceRates.map((service) => (
                  <tr key={service.type}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {service.type}
                      </div>
                      <div className="text-sm text-gray-500">
                        {service.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-brand-600">
                      {service.rate}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-600 sm:table-cell">
                      {service.typical}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            * Rates shown exclude the 10% platform fee. The total price
            including the fee is always displayed before you confirm a booking.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Rena vs. Competitors
          </h2>
          <p className="mt-4 text-gray-600">
            See how we stack up against traditional cleaning agencies and other
            platforms.
          </p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-sm font-semibold text-gray-900"
                  >
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center text-sm font-semibold text-brand-600"
                  >
                    Rena
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center text-sm font-semibold text-gray-500"
                  >
                    Platform A
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center text-sm font-semibold text-gray-500"
                  >
                    Agencies
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comparisonFeatures.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-brand-600">
                      {row.rena}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {row.competitor1}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
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
      <section className="bg-brand-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-white p-8 shadow-sm sm:p-12">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
                <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-gray-900">
                Our No Hidden Fees Guarantee
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
                The price you see at checkout is the price you pay. We will never
                add surprise charges, service fees, or booking fees. Our 10%
                platform fee is the only charge we make, and it is always
                included in the total shown to you.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/cleaners"
                  className="inline-block rounded-lg bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Browse Cleaners
                </Link>
                <Link
                  href="/guarantees"
                  className="inline-block rounded-lg border border-brand-600 px-8 py-3 font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  View All Guarantees
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
