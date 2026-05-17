import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: params.id },
      select: { id: true, hourlyRate: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
    }

    const date = new Date(dateParam);
    date.setHours(0, 0, 0, 0);

    const modifier = await prisma.rateModifier.findUnique({
      where: {
        cleanerProfileId_date: {
          cleanerProfileId: profile.id,
          date,
        },
      },
    });

    const baseRate = Number(profile.hourlyRate);
    const modifierPercent = modifier?.modifierPercent ?? 0;
    const effectiveRate = baseRate * (1 + modifierPercent / 100);

    return NextResponse.json({
      baseRate,
      modifierPercent,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      reason: modifier?.reason ?? null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RateForDate] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 });
  }
}
