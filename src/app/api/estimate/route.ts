import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { generateEstimate, type RoomDetail } from '@/lib/estimator';
import { getPriceBreakdown } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rooms, hasPets, extras, cleanerId } = body;

    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return NextResponse.json({ error: 'At least one room is required' }, { status: 400 });
    }

    const estimate = generateEstimate({
      rooms: rooms as RoomDetail[],
      hasPets: Boolean(hasPets),
      extras: Array.isArray(extras) ? extras : [],
    });

    let priceEstimate = null;
    if (cleanerId) {
      const profile = await prisma.cleanerProfile.findFirst({
        where: { userId: cleanerId },
        select: { hourlyRate: true },
      });

      if (profile) {
        const hourlyRate = Number(profile.hourlyRate);
        const sameDayRate = Math.round(hourlyRate * 1.4 * 100) / 100;
        const multiplier = estimate.recommendedServiceType === 'deep' ? 1.45 : 1;
        priceEstimate = {
          standard: getPriceBreakdown(hourlyRate, estimate.recommendedDuration, multiplier),
          sameDay: getPriceBreakdown(sameDayRate, estimate.recommendedDuration, multiplier),
        };
      }
    }

    return NextResponse.json({ estimate, priceEstimate });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET /api/estimate?postcode=NW4&bedrooms=2&bathrooms=1&serviceType=regular
 * Used by the hero quote widget for instant estimates.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postcode = searchParams.get('postcode');
    const bedrooms = Number(searchParams.get('bedrooms')) || 2;
    const bathrooms = Number(searchParams.get('bathrooms')) || 1;
    const serviceType = searchParams.get('serviceType') || 'standard';

    // Calculate average rate from cleaners in database
    const avgResult = await prisma.cleanerProfile.aggregate({
      where: { verified: true },
      _avg: { hourlyRate: true },
      _count: true,
    });

    const avgRate = Number(avgResult._avg.hourlyRate) || 25; // fallback to £25
    const cleanerCount = avgResult._count || 0;

    const SERVICE_MULTIPLIERS: Record<string, number> = {
      standard: 1.0,
      regular: 1.0,
      deep: 1.45,
      'end-of-tenancy': 1.45,
      'same-day': 1.3,
      'one-off': 1.1,
      airbnb: 1.45,
    };

    const hours = Math.max(2, bedrooms * 0.5 + bathrooms * 0.75 + 1);
    const multiplier = SERVICE_MULTIPLIERS[serviceType] ?? 1.0;
    const mid = avgRate * hours * multiplier;

    return NextResponse.json({
      min: Math.round(mid * 0.9 * 100) / 100,
      max: Math.round(mid * 1.1 * 100) / 100,
      average: Math.round(mid * 100) / 100,
      estimatedHours: hours,
      cleanerCount,
      postcode,
      serviceType,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
