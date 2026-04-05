import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
