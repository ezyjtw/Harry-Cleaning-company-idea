// C2: REAL social proof. The five hardcoded testimonials (invented names,
// postcodes and quotes — including one selling the not-yet-launched same-day
// service) are gone. This server component pulls the real pool:
//   • native Reviews (visibility VISIBLE, with text) — labelled "Rena customer"
//   • verified ImportedReviews (admin-VERIFIED, with text) — labelled by source
// Selection: best-first (rating desc), newest as the tie-break, capped at 6.
// INTERIM RULE: the section renders ONLY when ≥3 real reviews exist — a
// homepage without a reviews section beats one with fakes.

import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/db/prisma';

import ReviewsCarousel, { type HomepageReview } from './ReviewsCarousel';

const MIN_REVIEWS_TO_RENDER = 3;
const MAX_REVIEWS = 6;

function firstNameLastInitial(name: string | null): string {
  if (!name?.trim()) return 'Rena customer';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export default async function ReviewsSection() {
  let pool: HomepageReview[] = [];
  try {
    const [native, imported] = await Promise.all([
      prisma.review.findMany({
        where: { visibility: 'VISIBLE', text: { not: null } },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        take: MAX_REVIEWS,
        select: {
          id: true,
          rating: true,
          text: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      prisma.importedReview.findMany({
        where: { verificationStatus: 'VERIFIED', text: { not: null } },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        take: MAX_REVIEWS,
        select: {
          id: true,
          rating: true,
          text: true,
          createdAt: true,
          reviewerName: true,
          source: true,
        },
      }),
    ]);

    const combined = [
      ...native.map((r) => ({
        id: `n-${r.id}`,
        text: r.text as string,
        name: firstNameLastInitial(r.client?.name ?? null),
        sourceLabel: 'Rena customer',
        stars: Math.round(Number(r.rating)),
        rating: Number(r.rating),
        createdAt: r.createdAt,
      })),
      ...imported.map((r) => ({
        id: `i-${r.id}`,
        text: r.text as string,
        name: r.reviewerName?.trim() || 'Verified customer',
        sourceLabel: `Verified · via ${r.source}`,
        stars: Math.round(Number(r.rating)),
        rating: Number(r.rating),
        createdAt: r.createdAt,
      })),
    ]
      .filter((r) => r.text.trim().length > 0)
      .sort((a, b) => b.rating - a.rating || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_REVIEWS);

    pool = combined.map(({ id, text, name, sourceLabel, stars }) => ({
      id,
      text,
      name,
      sourceLabel,
      stars: Math.min(5, Math.max(1, stars)),
    }));
  } catch {
    // DB unavailable at render — skip the section rather than error the homepage.
    pool = [];
  }

  if (pool.length < MIN_REVIEWS_TO_RENDER) return null;

  const t = await getTranslations('Reviews');
  return (
    <ReviewsCarousel
      reviews={pool}
      sectionTitle={t('sectionTitle')}
      sectionSubtitle={t('sectionSubtitle')}
    />
  );
}
