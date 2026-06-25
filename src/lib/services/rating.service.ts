import { prisma } from '@/lib/db/prisma';

export interface CleanerRating {
  overall: number | null;
  totalCount: number;
  nativeCount: number;
  importedCount: number;
  subRatings: {
    thoroughness: number | null;
    punctuality: number | null;
    communication: number | null;
  };
}

/**
 * Single source of truth for cleaner rating computation.
 *
 * overall = blended average of native VISIBLE reviews + imported VERIFIED reviews.
 *           PENDING/REJECTED imports are excluded. All count equally.
 *
 * subRatings = native VISIBLE reviews ONLY. Imported reviews never carry
 *              sub-categories — they can't be verified against external platforms.
 *
 * Edge case: cleaner with only imported reviews → overall is set, subRatings are null.
 */
export async function computeCleanerRating(cleanerId: string): Promise<CleanerRating> {
  const [nativeAgg, importedAgg, nativeSubs] = await Promise.all([
    // Native VISIBLE reviews — overall rating
    prisma.review.aggregate({
      where: { cleanerId, visibility: 'VISIBLE' },
      _avg: { rating: true },
      _count: true,
    }),

    // Imported VERIFIED reviews — overall rating
    prisma.importedReview.aggregate({
      where: { cleanerId, verificationStatus: 'VERIFIED' },
      _avg: { rating: true },
      _count: true,
    }),

    // Native VISIBLE reviews — sub-ratings (separate query to handle nulls correctly)
    prisma.review.aggregate({
      where: {
        cleanerId,
        visibility: 'VISIBLE',
        thoroughness: { not: null },
      },
      _avg: { thoroughness: true, punctuality: true, communication: true },
      _count: true,
    }),
  ]);

  const nativeCount = nativeAgg._count;
  const importedCount = importedAgg._count;
  const totalCount = nativeCount + importedCount;

  let overall: number | null = null;
  if (totalCount > 0) {
    const nativeSum = nativeAgg._avg.rating ? Number(nativeAgg._avg.rating) * nativeCount : 0;
    const importedSum = importedAgg._avg.rating
      ? Number(importedAgg._avg.rating) * importedCount
      : 0;
    overall = Math.round(((nativeSum + importedSum) / totalCount) * 10) / 10;
  }

  const hasSubRatings = nativeSubs._count > 0;

  return {
    overall,
    totalCount,
    nativeCount,
    importedCount,
    subRatings: {
      thoroughness:
        hasSubRatings && nativeSubs._avg.thoroughness !== null
          ? Math.round(Number(nativeSubs._avg.thoroughness) * 10) / 10
          : null,
      punctuality:
        hasSubRatings && nativeSubs._avg.punctuality !== null
          ? Math.round(Number(nativeSubs._avg.punctuality) * 10) / 10
          : null,
      communication:
        hasSubRatings && nativeSubs._avg.communication !== null
          ? Math.round(Number(nativeSubs._avg.communication) * 10) / 10
          : null,
    },
  };
}

/**
 * Recompute and persist the overall rating to CleanerProfile.rating.
 * Call after any event that changes the blended average (native review created,
 * imported review verified/rejected, native review moderated).
 */
export async function updateStoredRating(cleanerId: string): Promise<number | null> {
  const { overall } = await computeCleanerRating(cleanerId);
  if (overall !== null) {
    await prisma.cleanerProfile.updateMany({
      where: { userId: cleanerId },
      data: { rating: overall },
    });
  }
  return overall;
}
