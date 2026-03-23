import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { generateEstimate, type RoomDetail } from '@/lib/estimator';
import { getCleanerById, cleaners } from '@/lib/mock-data';
import { getPriceBreakdown } from '@/lib/pricing';

export async function POST(request: NextRequest) {
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

  // If a cleaner ID is provided, include price estimate
  let priceEstimate = null;
  if (cleanerId) {
    const cleaner = getCleanerById(cleanerId);
    if (cleaner) {
      const multiplier = estimate.recommendedServiceType === 'deep' ? 1.45 : 1;
      priceEstimate = {
        standard: getPriceBreakdown(cleaner.hourlyRate, estimate.recommendedDuration, multiplier),
        sameDay: getPriceBreakdown(cleaner.sameDayRate, estimate.recommendedDuration, multiplier),
      };
    }
  }

  return NextResponse.json({
    estimate,
    priceEstimate,
  });
}

/**
 * GET /api/estimate?postcode=NW4&bedrooms=2&bathrooms=1&serviceType=regular
 * Used by the hero quote widget for instant estimates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode');
  const bedrooms = Number(searchParams.get('bedrooms')) || 2;
  const bathrooms = Number(searchParams.get('bathrooms')) || 1;
  const serviceType = searchParams.get('serviceType') || 'standard';

  // Calculate average rate from available cleaners
  const avgRate = cleaners.reduce((sum, c) => sum + c.hourlyRate, 0) / cleaners.length;

  // Simple estimate calculation
  const SERVICE_MULTIPLIERS: Record<string, number> = {
    standard: 1.0,
    regular: 1.0,
    deep: 1.45,
    'end-of-tenancy': 1.45, // Fixed-price service — uses deep multiplier as approximation
    'same-day': 1.3,
    'one-off': 1.1,
    airbnb: 1.45, // Fixed-price service — uses deep multiplier as approximation
  };
  const hours = Math.max(2, bedrooms * 0.5 + bathrooms * 0.75 + 1);
  const multiplier = SERVICE_MULTIPLIERS[serviceType] ?? 1.0;
  const mid = avgRate * hours * multiplier;
  const estimate = {
    min: Math.round(mid * 0.9 * 100) / 100,
    max: Math.round(mid * 1.1 * 100) / 100,
    average: Math.round(mid * 100) / 100,
    estimatedHours: hours,
  };

  // Count cleaners "near" this postcode (mock)
  const cleanerCount = Math.min(cleaners.length, Math.floor(Math.random() * 4) + 3);

  return NextResponse.json({
    min: estimate.min,
    max: estimate.max,
    average: estimate.average,
    estimatedHours: estimate.estimatedHours,
    cleanerCount,
    postcode,
    serviceType,
  });
}
