import type { Metadata } from 'next';
import Link from 'next/link';

import { SERVICE_AREAS } from '@/lib/areas';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

export const metadata: Metadata = {
  title: 'Areas We Serve — Cleaners Across North-East London and Essex',
  description:
    'Rena serves north-east London and the surrounding areas of Essex. Find vetted, reviewed local cleaners in Chingford, Walthamstow, Leyton, Woodford, Loughton and more.',
  alternates: { canonical: `${BASE_URL}/cleaning` },
  openGraph: {
    title: 'Areas We Serve | Rena Cleaning Network',
    description:
      'Find vetted, reviewed local cleaners across north-east London and the surrounding areas of Essex.',
    url: `${BASE_URL}/cleaning`,
  },
};

export default function AreasIndexPage() {
  return (
    <div className="min-h-screen bg-page">
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="font-newsreader text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
            Areas We Serve
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-jost text-lg font-light text-cream/80">
            Proudly serving north-east London and surrounding areas of Essex — and growing. Pick
            your area to see the vetted cleaners near you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {SERVICE_AREAS.map((area) => (
            <Link
              key={area.slug}
              href={`/cleaning/${area.slug}`}
              className="rounded-lg border border-line bg-surface p-5 transition-colors hover:bg-cream"
            >
              <p className="font-newsreader text-xl font-semibold text-ink">{area.name}</p>
              <p className="mt-1 font-jost text-[13px] font-light text-ink-3">
                Cleaners in {area.outcodeLabel}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-center font-jost text-sm font-light text-ink-2">
          Not listed? We may still cover you,{' '}
          <Link href="/cleaners" className="text-primary underline">
            enter your postcode
          </Link>{' '}
          to check.
        </p>
      </section>
    </div>
  );
}
