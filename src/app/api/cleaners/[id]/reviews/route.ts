import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify cleaner exists
    const cleaner = await prisma.user.findFirst({
      where: { id: params.id, role: 'CLEANER' },
    });

    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
    }

    const reviews = await prisma.review.findMany({
      where: {
        cleanerId: params.id,
        visibility: 'VISIBLE',
      },
      include: {
        client: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // H16 sweep: reviewer avatars go out RESOLVED like every other surface —
    // a raw storage key in `client.image` renders as a broken image.
    const { resolveProfileImageUrl } = await import('@/lib/storage/r2-client');
    const resolved = await Promise.all(
      reviews.map(async (r) => ({
        ...r,
        client: r.client
          ? { ...r.client, image: await resolveProfileImageUrl(r.client.image) }
          : r.client,
      }))
    );

    // H28 (James-ruled transparency): the profile modal shows BOTH populations,
    // separated — so this endpoint ships VERIFIED imports alongside. PENDING /
    // REJECTED never leave the building.
    const imported = await prisma.importedReview.findMany({
      where: { cleanerId: params.id, verificationStatus: 'VERIFIED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, rating: true, text: true, source: true, reviewerName: true },
    });

    return NextResponse.json({
      reviews: resolved,
      imported: imported.map((r) => ({ ...r, rating: Number(r.rating) })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
