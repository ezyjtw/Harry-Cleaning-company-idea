import { NextResponse } from "next/server";
import { getCleanerById, getReviewsForCleaner } from "@/lib/mock-data";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const cleaner = getCleanerById(params.id);

  if (!cleaner) {
    return NextResponse.json({ error: "Cleaner not found" }, { status: 404 });
  }

  const reviews = getReviewsForCleaner(params.id);

  return NextResponse.json({ ...cleaner, reviews });
}
