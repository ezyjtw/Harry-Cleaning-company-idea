import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rena.com';
const SITE_NAME = 'Rena Cleaning Network';

export function generatePageMetadata(options: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = options.path ? `${BASE_URL}${options.path}` : BASE_URL;
  const image = options.image || `${BASE_URL}/og-image.png`;

  return {
    title: `${options.title} | ${SITE_NAME}`,
    description: options.description,
    openGraph: {
      title: options.title,
      description: options.description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630, alt: options.title }],
      locale: 'en_GB',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: options.title,
      description: options.description,
      images: [image],
    },
    alternates: { canonical: url },
    robots: options.noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const PAGE_METADATA = {
  home: generatePageMetadata({
    title: 'Book Trusted Cleaners',
    description:
      'Book vetted, trusted cleaners in London. Fair pricing with just 10% platform fee. Cleaners keep 90% of earnings.',
    path: '/',
  }),
  cleaners: generatePageMetadata({
    title: 'Find Cleaners Near You',
    description:
      'Browse verified cleaners in your area. Compare ratings, prices, and specialties. Book in minutes.',
    path: '/cleaners',
  }),
  services: generatePageMetadata({
    title: 'Cleaning Services',
    description:
      'Professional cleaning services: regular, deep clean, end of tenancy, AirBnB turnover, and more.',
    path: '/services',
  }),
  pricing: generatePageMetadata({
    title: 'Transparent Pricing',
    description:
      'Simple, fair pricing with no hidden fees. Just 10% platform fee — the lowest in the industry.',
    path: '/pricing',
  }),
  about: generatePageMetadata({
    title: 'About Us',
    description:
      'Rena connects customers with vetted cleaners. Fair for everyone — cleaners keep 90%.',
    path: '/about',
  }),
  faq: generatePageMetadata({
    title: 'Frequently Asked Questions',
    description:
      'Common questions about booking cleaners, pricing, payments, and our service guarantee.',
    path: '/faq',
  }),
  join: generatePageMetadata({
    title: 'Become a Cleaner',
    description:
      'Join Rena and keep 90% of your earnings. Set your own hours, rates, and service areas.',
    path: '/join',
  }),
};
