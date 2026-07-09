import type { MetadataRoute } from 'next';

import { SERVICE_AREAS } from '@/lib/areas';
import { countCoveringPoint, eligibleCleanerGeos } from '@/lib/services/area-search.service';
import { lookupOutcode } from '@/lib/utils/postcode';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// A1-P1: service slugs must match the REAL /services/[category] routes
// (ServiceCategory in lib/types.ts) — the previous list advertised six
// fictional URLs (regular-cleaning, office-cleaning, …) that soft-404'd.
const SERVICES = ['regular', 'same-day', 'deep', 'airbnb', 'end-of-tenancy'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Core pages
  const corePages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/cleaners`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    {
      url: `${BASE_URL}/how-it-works`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/guarantees`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/join`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Service pages
  const servicePages: MetadataRoute.Sitemap = SERVICES.map((service) => ({
    url: `${BASE_URL}/services/${service}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // A3: location pages — only areas that pass the ruled 0-cleaner prune (the
  // same coverage decision the pages themselves make; an area page that would
  // 404 never enters the sitemap). Any failure (DB or geocode) omits the
  // area pages rather than advertising possibly-404 URLs.
  let areaPages: MetadataRoute.Sitemap = [];
  try {
    const geos = await eligibleCleanerGeos();
    const shipped = await Promise.all(
      SERVICE_AREAS.map(async (area) => {
        const centroid = await lookupOutcode(area.outcode);
        if (!centroid) return null; // lookup failure → page renders (fail-open) but sitemap skips
        return countCoveringPoint(geos, centroid.latitude, centroid.longitude) > 0 ? area : null;
      })
    );
    const live = shipped.filter((a): a is NonNullable<typeof a> => a !== null);
    areaPages = [
      ...(live.length > 0
        ? [{ url: `${BASE_URL}/cleaning`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 }]
        : []),
      ...live.map((area) => ({
        url: `${BASE_URL}/cleaning/${area.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch {
    areaPages = [];
  }

  return [...corePages, ...servicePages, ...areaPages];
}
