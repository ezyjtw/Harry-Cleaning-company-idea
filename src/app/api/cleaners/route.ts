import { NextRequest, NextResponse } from "next/server";
import { cleaners, searchCleaners, getAvailableNowCleaners } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const availableNow = searchParams.get("available_now");

  let results = cleaners;

  if (query) {
    results = searchCleaners(query);
  }

  if (availableNow === "true") {
    results = results.filter((c) => c.availableNow);
  }

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = ["name", "email", "phone", "location", "bio", "hourlyRate"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  // In production, this would save to a database
  const newCleaner = {
    id: String(Date.now()),
    name: body.name,
    email: body.email,
    phone: body.phone,
    photo: "",
    rating: 0,
    reviewCount: 0,
    hourlyRate: Number(body.hourlyRate),
    bio: body.bio,
    specialties: body.specialties || [],
    location: body.location,
    verified: false,
    yearsExperience: Number(body.experience) || 0,
    completedJobs: 0,
    availability: [],
    status: "pending_review",
  };

  return NextResponse.json(
    { message: "Application submitted successfully", cleaner: newCleaner },
    { status: 201 }
  );
}
