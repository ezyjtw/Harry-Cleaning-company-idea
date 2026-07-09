import type { Metadata } from 'next';

import JsonLd from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// A1-P2: per-category metadata + Service JSON-LD. Every category previously
// shared the /services layout's generic metadata. Descriptions carry no price
// figures (canonical-price rule) and no same-day availability claims (same-day
// is not launched — its copy says so).
const CATEGORY_SEO: Record<string, { title: string; description: string; serviceName: string }> = {
  regular: {
    title: 'Regular Home Cleaning',
    description:
      'Book a vetted local cleaner for weekly or fortnightly home cleaning in north-east London and surrounding areas of Essex. Compare real profiles, reviews and rates.',
    serviceName: 'Regular home cleaning',
  },
  deep: {
    title: 'Deep Cleaning',
    description:
      'Intensive top-to-bottom deep cleans by vetted independent cleaners in north-east London and surrounding areas of Essex. Choose your cleaner, see the full price upfront.',
    serviceName: 'Deep cleaning',
  },
  'same-day': {
    title: 'Same-Day Cleaning — Coming Soon',
    description:
      'Same-day cleaning is coming soon to Rena. Browse vetted local cleaners in north-east London and Essex today, and book regular or deep cleans in minutes.',
    serviceName: 'Same-day cleaning (coming soon)',
  },
  airbnb: {
    title: 'Airbnb & Short-Let Cleaning',
    description:
      'Reliable turnover cleans for Airbnb and short-let hosts in north-east London and surrounding areas of Essex, by vetted independent cleaners with transparent fixed prices.',
    serviceName: 'Airbnb / short-let turnover cleaning',
  },
  'end-of-tenancy': {
    title: 'End of Tenancy Cleaning',
    description:
      'Fixed-price end of tenancy cleans by vetted independent cleaners in north-east London and surrounding areas of Essex. See the full price before you book.',
    serviceName: 'End of tenancy cleaning',
  },
};

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const seo = CATEGORY_SEO[params.category];
  if (!seo) return {};
  const url = `${BASE_URL}/services/${params.category}`;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    openGraph: { title: seo.title, description: seo.description, url, type: 'website' },
  };
}

export default function ServiceCategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { category: string };
}) {
  const seo = CATEGORY_SEO[params.category];
  return (
    <>
      {seo && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: seo.serviceName,
            description: seo.description,
            provider: { '@type': 'Organization', name: 'Rena Cleaning Network' },
            areaServed: 'North-east London and surrounding areas of Essex',
            url: `${BASE_URL}/services/${params.category}`,
          }}
        />
      )}
      {children}
    </>
  );
}
