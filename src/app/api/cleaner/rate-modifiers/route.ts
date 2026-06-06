import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const modifiers = await prisma.rateModifier.findMany({
      where: {
        cleanerProfileId: profile.id,
        date: { gte: new Date() },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ modifiers });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RateModifiers] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch rate modifiers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, hourlyRateRegular: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { dates, modifierPercent, reason } = body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'At least one date is required' }, { status: 400 });
    }

    if (typeof modifierPercent !== 'number' || modifierPercent < -50 || modifierPercent > 200) {
      return NextResponse.json(
        { error: 'Modifier must be between -50% and +200%' },
        { status: 400 }
      );
    }

    if (modifierPercent === 0) {
      return NextResponse.json({ error: 'Modifier cannot be 0%' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDates = dates.map((d: string) => new Date(d)).filter((d: Date) => d >= today);

    if (validDates.length === 0) {
      return NextResponse.json(
        { error: 'All dates must be today or in the future' },
        { status: 400 }
      );
    }

    const modifiers = await prisma.$transaction(
      validDates.map((date: Date) =>
        prisma.rateModifier.upsert({
          where: {
            cleanerProfileId_date: {
              cleanerProfileId: profile.id,
              date,
            },
          },
          create: {
            cleanerProfileId: profile.id,
            date,
            modifierPercent,
            reason: reason?.trim() || null,
          },
          update: {
            modifierPercent,
            reason: reason?.trim() || null,
          },
        })
      )
    );

    return NextResponse.json(
      { message: `${modifiers.length} modifier(s) applied`, modifiers },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RateModifiers] POST error:', error);
    return NextResponse.json({ error: 'Failed to save rate modifiers' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    await prisma.rateModifier.delete({
      where: {
        cleanerProfileId_date: {
          cleanerProfileId: profile.id,
          date: new Date(dateParam),
        },
      },
    });

    return NextResponse.json({ message: 'Modifier removed' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RateModifiers] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove modifier' }, { status: 500 });
  }
}
