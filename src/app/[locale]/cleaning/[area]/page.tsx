import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import CleanerIdentity from '@/components/CleanerIdentity';
import JsonLd from '@/components/JsonLd';
import { getServiceArea, SERVICE_AREAS } from '@/lib/areas';
import { findCleanersNearPoint, findReviewsForCleaners } from '@/lib/services/area-search.service';
import { lookupOutcode } from '@/lib/utils/postcode';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// Live cleaner data (counts, cards, rates) refreshes hourly — same cadence as
// the homepage reviews section.
export const revalidate = 3600;

export function generateMetadata({ params }: { params: { area: string } }): Metadata {
  const area = getServiceArea(params.area);
  if (!area) return {};
  const url = `${BASE_URL}/cleaning/${area.slug}`;
  const title = `Cleaners in ${area.name}, ${area.outcodeLabel}`;
  const description = `Find vetted, reviewed cleaners in ${area.name} (${area.outcodeLabel}). Compare real profiles, reviews and rates, and choose who comes to your door. The price you see is the price you pay.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  };
}

export default async function AreaPage({ params }: { params: { area: string } }) {
  const area = getServiceArea(params.area);
  if (!area) notFound();

  // Anchor the area at its outward-code centroid, then run the SAME coverage
  // decision search runs. If the centroid lookup fails (postcodes.io outage),
  // render without the live strip rather than 404 — fail-open, like search.
  const centroid = await lookupOutcode(area.outcode);
  const result = centroid
    ? await findCleanersNearPoint(centroid.latitude, centroid.longitude, 6)
    : null;

  // A2 ruled 0-cleaner prune: an area we can PROVE has no cleaners doesn't
  // ship. (A failed lookup is not proof — the page renders its static content.)
  if (result && result.total === 0) notFound();

  const reviews = result ? await findReviewsForCleaners(result.cleaners.map((c) => c.id), 3) : [];
  const neighbors = area.neighbors
    .map((slug) => SERVICE_AREAS.find((a) => a.slug === slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const ratesAnswer = result?.rateRange
    ? result.rateRange.min === result.rateRange.max
      ? `Cleaners set their own hourly rates and you see them upfront on every profile — ${area.name} cleaners currently charge £${result.rateRange.min.toFixed(2)}/hr for regular cleaning. Your checkout price is all-inclusive.`
      : `Cleaners set their own hourly rates and you see them upfront on every profile — most ${area.name} cleaners charge £${result.rateRange.min.toFixed(2)}–£${result.rateRange.max.toFixed(2)}/hr for regular cleaning. Your checkout price is all-inclusive.`
    : 'Cleaners set their own hourly rates and you see them upfront on every profile. Your checkout price is all-inclusive.';

  const faq = [
    { q: `Do you cover all of ${area.outcodeLabel}?`, a: area.coversAnswer },
    { q: `How much does a cleaner in ${area.name} cost?`, a: ratesAnswer },
    {
      q: 'Can I pick my own cleaner?',
      // James-ruled truthful framing: choice first, rescue second.
      a: "Always. You browse profiles, reviews and rates, and decide who comes to your door. And if your chosen cleaner ever can't make it, we don't leave you stranded — we help you pick a replacement, or our team personally finds you someone.",
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Home cleaning in ${area.name}`,
    provider: {
      '@type': 'Organization',
      name: 'Rena Cleaning Network',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '66 Paul Street',
        addressLocality: 'London',
        postalCode: 'EC2A 4NA',
        addressCountry: 'GB',
      },
    },
    areaServed: `${area.name}, ${area.outcodeLabel}`,
    url: `${BASE_URL}/cleaning/${area.slug}`,
  };

  return (
    <div className="min-h-screen bg-page">
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="font-jost text-[12px] uppercase tracking-[0.16em] text-cream/60">
            Areas we serve
          </p>
          <h1 className="mt-2 font-newsreader text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
            Cleaners in {area.name}, {area.outcodeLabel}
          </h1>
          <p className="mt-5 max-w-2xl font-jost text-lg font-light leading-relaxed text-cream/80">
            {area.intro}
          </p>
        </div>
      </section>

      {/* Live cleaner strip */}
      {result && (
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            {result.total} cleaner{result.total === 1 ? '' : 's'} serve{result.total === 1 ? 's' : ''}{' '}
            {area.name}
          </h2>
          {result.total <= 3 && (
            <p className="mt-2 font-jost font-light text-ink-2">
              — and more are joining. See {result.total === 1 ? 'them' : 'each of them'} below, or{' '}
              <Link
                href={`/cleaners?postcode=${encodeURIComponent(area.outcode)}`}
                className="text-primary underline"
              >
                check your exact postcode
              </Link>
              .
            </p>
          )}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.cleaners.map((c) => (
              <Link
                key={c.id}
                href={`/cleaners/${c.id}`}
                className="rounded-lg border border-line bg-surface p-4 transition-colors hover:bg-cream"
              >
                <CleanerIdentity
                  photo={c.photo}
                  name={c.name}
                  verified
                  rating={c.rating}
                  reviewCount={c.reviewCount}
                  meta={
                    <>
                      {c.location || area.name}
                      {c.fromPrice !== null && <> · from £{c.fromPrice.toFixed(2)}/hr</>}
                    </>
                  }
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Real reviews — section exists only when real reviews do */}
      {reviews.length > 0 && (
        <section className="bg-cream-2 py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="font-newsreader text-2xl font-semibold text-ink">
              What customers near {area.name} say
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-line bg-surface p-5">
                  <p className="font-jost text-[13px] tracking-[2px] text-gold">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </p>
                  <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <p className="mt-3 font-jost text-[13px] font-medium text-ink">
                    {r.clientName} · about {r.cleanerName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works, condensed */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="font-newsreader text-2xl font-semibold text-ink">How it works</h2>
        <ul className="mt-4 space-y-2 font-jost font-light text-ink-2">
          <li>· Choose your cleaner from real profiles</li>
          <li>· Book online in two minutes</li>
          <li>· Pay securely — one all-inclusive price</li>
        </ul>
        <Link
          href={`/cleaners?postcode=${encodeURIComponent(area.outcode)}`}
          className="mt-8 inline-block rounded-md bg-primary px-7 py-3.5 font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
        >
          See {area.name} cleaners →
        </Link>
      </section>

      {/* Local FAQ */}
      <section className="bg-cream-2 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            {area.name} questions, answered
          </h2>
          <div className="mt-6 space-y-6">
            {faq.map((f) => (
              <div key={f.q}>
                <h3 className="font-newsreader text-lg font-semibold text-ink">{f.q}</h3>
                <p className="mt-2 font-jost font-light leading-relaxed text-ink-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Neighbour cross-links */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="font-jost text-[12px] uppercase tracking-[0.14em] text-ink-3">Nearby areas</p>
        <p className="mt-3 font-jost font-light text-ink-2">
          {neighbors.map((n, i) => (
            <span key={n.slug}>
              {i > 0 && ' · '}
              <Link href={`/cleaning/${n.slug}`} className="text-primary underline">
                Cleaners in {n.name}
              </Link>
            </span>
          ))}
          {' · '}
          <Link href="/cleaning" className="text-primary underline">
            All areas
          </Link>
        </p>
      </section>
    </div>
  );
}
