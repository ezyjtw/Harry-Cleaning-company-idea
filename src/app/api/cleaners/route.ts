import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { cleaners, searchCleaners } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const availableNow = searchParams.get('available_now');
  const postcode = searchParams.get('postcode');
  const radius = Number(searchParams.get('radius')) || 10;

  let results = cleaners;

  if (query) {
    results = searchCleaners(query);
  }

  if (availableNow === 'true') {
    results = results.filter((c) => c.availableNow);
  }

  // If postcode is provided, simulate distance-based filtering
  // In production, this would use Haversine with real lat/lng from the DB
  if (postcode) {
    // For now, return all cleaners sorted by mock distance
    results = results.map((c, i) => ({
      ...c,
      distance: Math.round((1 + i * 1.3) * 10) / 10,
    }));
    results = results
      .filter((c) =>
        'distance' in c ? (c as typeof c & { distance: number }).distance <= radius : true
      )
      .sort((a, b) => {
        const distA = 'distance' in a ? (a as typeof a & { distance: number }).distance : 999;
        const distB = 'distance' in b ? (b as typeof b & { distance: number }).distance : 999;
        return distA - distB;
      });
  }

  return NextResponse.json({
    cleaners: results,
    count: results.length,
    postcode: postcode || undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = ['name', 'email', 'phone'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // In production, this would save to DB in a transaction (User + CleanerProfile)
  const newCleaner = {
    id: String(Date.now()),
    name: body.name,
    email: body.email,
    phone: body.phone,
    photo: '',
    rating: 0,
    reviewCount: 0,
    hourlyRate: Number(body.hourlyRate) || 25,
    bio: body.bio || '',
    specialties: body.specialties || [],
    languages: body.languages || ['English'],
    location: body.location || body.postcode || '',
    postcode: body.postcode || '',
    verified: false,
    verificationStatus: 'PENDING',
    yearsExperience: Number(body.experience) || 0,
    completedJobs: 0,
    availability: [],
    status: 'pending_review',
  };

  return NextResponse.json(
    { message: 'Application submitted successfully', cleaner: newCleaner },
    { status: 201 }
  );
}
