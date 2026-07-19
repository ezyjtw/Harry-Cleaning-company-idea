import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { sanitizeInput } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ratingFilter = Number(searchParams.get('rating')) || 0;

  const where: Record<string, unknown> = {
    cleanerId: user.id,
    visibility: 'VISIBLE',
  };

  if (ratingFilter > 0) {
    where.rating = { gte: ratingFilter, lt: ratingFilter + 1 };
  }

  const [reviews, allReviews, profile] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // For distribution and averages, get all reviews
    prisma.review.findMany({
      where: { cleanerId: user.id, visibility: 'VISIBLE' },
      select: {
        rating: true,
        thoroughness: true,
        punctuality: true,
        communication: true,
      },
    }),
    prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { rating: true },
    }),
  ]);

  // Rating distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let thoroughnessSum = 0,
    punctualitySum = 0,
    communicationSum = 0;
  let categoryCount = 0;

  for (const r of allReviews) {
    const stars = Math.round(Number(r.rating));
    if (stars >= 1 && stars <= 5) distribution[stars]++;
    if (r.thoroughness) {
      thoroughnessSum += Number(r.thoroughness);
      categoryCount++;
    }
    if (r.punctuality) punctualitySum += Number(r.punctuality);
    if (r.communication) communicationSum += Number(r.communication);
  }

  const avgCategories =
    categoryCount > 0
      ? {
          thoroughness: Math.round((thoroughnessSum / categoryCount) * 10) / 10,
          punctuality: Math.round((punctualitySum / categoryCount) * 10) / 10,
          communication: Math.round((communicationSum / categoryCount) * 10) / 10,
        }
      : { thoroughness: 0, punctuality: 0, communication: 0 };

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      clientName: r.client.name || 'Anonymous',
      date: r.createdAt.toISOString().split('T')[0],
      rating: Number(r.rating),
      comment: r.text || '',
      reply: r.reply || null,
      categories: {
        thoroughness: Number(r.thoroughness) || 0,
        punctuality: Number(r.punctuality) || 0,
        communication: Number(r.communication) || 0,
      },
    })),
    overallRating: Number(profile?.rating) || 0,
    totalReviews: allReviews.length,
    distribution,
    avgCategories,
    // H25: the population behind avgCategories — how many Rena reviews carry
    // sub-ratings. The portal labels the breakdown with it (imported reviews
    // never contribute categories).
    categoryCount,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { reviewId, reply } = body;

  if (!reviewId || typeof reply !== 'string') {
    return NextResponse.json({ error: 'reviewId and reply are required' }, { status: 400 });
  }

  // Verify the review belongs to this cleaner
  const review = await prisma.review.findFirst({
    where: { id: reviewId, cleanerId: user.id },
  });

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  const sanitizedReply = sanitizeInput(reply).substring(0, 2000);

  await prisma.review.update({
    where: { id: reviewId },
    data: { reply: sanitizedReply },
  });

  return NextResponse.json({ success: true });
}
