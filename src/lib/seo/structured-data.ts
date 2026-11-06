/**
 * JSON-LD Structured Data generators for SEO.
 * Generates schema.org compliant structured data.
 */

import { SERVICE_AREAS, type ServiceArea } from '@/lib/areas';

// RENA-057 (B6.5, James-ruled): the registered office, the one real address.
const REGISTERED_OFFICE = {
  '@type': 'PostalAddress',
  streetAddress: '66 Paul Street',
  addressLocality: 'London',
  postalCode: 'EC2A 4NA',
  addressCountry: 'GB',
} as const;

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Rena Cleaning Network',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk',
    logo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk'}/icons/icon-512x512.png`,
    description:
      'Book trusted, vetted cleaners in your area. Fair, all-inclusive pricing — the price you see is the price you pay.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '66 Paul Street',
      addressLocality: 'London',
      postalCode: 'EC2A 4NA',
      addressCountry: 'GB',
    },
    areaServed: 'North-east London and surrounding areas of Essex',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English'],
    },
  };
}

export function generateServiceSchema(service: {
  name: string;
  description: string;
  price: number;
  priceCurrency?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: 'Rena Cleaning Network',
    },
    areaServed: {
      '@type': 'City',
      name: 'London',
    },
    offers: {
      '@type': 'Offer',
      price: service.price,
      priceCurrency: service.priceCurrency || 'GBP',
      availability: 'https://schema.org/InStock',
    },
  };
}

// RENA-057 (B6.5): no invented geo point; the registered office address and
// the served areas by name and outward code.
export function generateLocalBusinessSchema(area: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `Rena Cleaning Network - ${area}`,
    description: `Professional cleaning services in ${area}. Book vetted cleaners with fair, all-inclusive pricing.`,
    address: REGISTERED_OFFICE,
    areaServed: SERVICE_AREAS.map((a) => ({
      '@type': 'Place',
      name: a.name,
      address: { '@type': 'PostalAddress', postalCode: a.outcode, addressCountry: 'GB' },
    })),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '07:00',
      closes: '20:00',
    },
    priceRange: '££',
  };
}

// RENA-057 (B6.5): each area page's Service names its Place, with the
// outward-code centroid the page already looked up; no geo when it failed.
export function generateAreaServiceSchema(
  area: Pick<ServiceArea, 'name' | 'outcodeLabel' | 'slug'>,
  centroid: { latitude: number; longitude: number } | null,
  baseUrl: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Home cleaning in ${area.name}`,
    provider: {
      '@type': 'Organization',
      name: 'Rena Cleaning Network',
      address: REGISTERED_OFFICE,
    },
    areaServed: {
      '@type': 'Place',
      name: `${area.name}, ${area.outcodeLabel}`,
      ...(centroid
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: centroid.latitude,
              longitude: centroid.longitude,
            },
          }
        : {}),
    },
    url: `${baseUrl}/cleaning/${area.slug}`,
  };
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
