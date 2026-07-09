import { prisma } from '@/lib/db/prisma';

// Derived from the app's actual client (which globally omits catchmentPolygon)
// so transaction clients and the singleton both satisfy it.
type PrismaLike = Pick<typeof prisma, 'review' | 'importedReview' | 'cleanerProfile'>;

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
 *           PENDING/REJECTED imports are excluded. All count equally (pooled average).
 *
 * subRatings = native VISIBLE reviews ONLY. Imported reviews never carry
 *              sub-categories — they can't be verified against external platforms.
 *
 * Edge case: cleaner with only imported reviews → overall is set, subRatings are null.
 *
 * @param db  Optional Prisma tx client. When called inside a $transaction, pass
 *            the tx so the aggregate sees the transaction's own writes (e.g. a
 *            just-created native review). Falls back to the singleton prisma client.
 */
export async function computeCleanerRating(
  cleanerId: string,
  db?: PrismaLike
): Promise<CleanerRating> {
  const client = db ?? prisma;

  const [nativeAgg, importedAgg, nativeSubs] = await Promise.all([
    client.review.aggregate({
      where: { cleanerId, visibility: 'VISIBLE' },
      _avg: { rating: true },
      _count: true,
    }),

    client.importedReview.aggregate({
      where: { cleanerId, verificationStatus: 'VERIFIED' },
      _avg: { rating: true },
      _count: true,
    }),

    client.review.aggregate({
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
 * Call after any event that changes the blended average.
 *
 * @param db  Optional Prisma tx client — pass the tx when calling from inside
 *            a $transaction so the write participates in the same atomic unit.
 */
export async function updateStoredRating(
  cleanerId: string,
  db?: PrismaLike
): Promise<number | null> {
  const client = db ?? prisma;
  const { overall } = await computeCleanerRating(cleanerId, client);
  if (overall !== null) {
    await client.cleanerProfile.updateMany({
      where: { userId: cleanerId },
      data: { rating: overall },
    });
  }
  return overall;
}
