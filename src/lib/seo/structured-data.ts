/**
 * JSON-LD Structured Data generators for SEO.
 * Generates schema.org compliant structured data.
 */

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Rena Cleaning Network',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://rena.com',
    logo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://rena.com'}/icons/icon-512x512.png`,
    description:
      'Book trusted, vetted cleaners in your area. Fair pricing with just a 5% service fee.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'London',
      addressCountry: 'GB',
    },
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

export function generateLocalBusinessSchema(area: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `Rena Cleaning Network - ${area}`,
    description: `Professional cleaning services in ${area}. Book vetted cleaners with just a 5% service fee.`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: area,
      addressRegion: 'London',
      addressCountry: 'GB',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 51.5074,
      longitude: -0.1278,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '07:00',
      closes: '20:00',
    },
    priceRange: '££',
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

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateReviewAggregateSchema(data: {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    ratingValue: data.ratingValue,
    reviewCount: data.reviewCount,
    bestRating: data.bestRating ?? 5,
    worstRating: 1,
  };
}
