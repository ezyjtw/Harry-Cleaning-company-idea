import { NextRequest, NextResponse } from "next/server";
import { generateEstimate, type RoomDetail } from "@/lib/estimator";
import { getCleanerById } from "@/lib/mock-data";
import { getPriceBreakdown } from "@/lib/pricing";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { rooms, hasPets, extras, cleanerId } = body;

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    return NextResponse.json(
      { error: "At least one room is required" },
      { status: 400 }
    );
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
      const multiplier = estimate.recommendedServiceType === "deep" ? 1.5 : 1;
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
