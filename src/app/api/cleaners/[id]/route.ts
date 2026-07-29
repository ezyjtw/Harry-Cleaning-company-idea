import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const profile = await prisma.cleanerProfile.findFirst({
      where: {
        userId: params.id,
        verified: true,
        insuranceVerified: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        // F26: hidden profiles are not served by direct URL either — the
        // switch means gone from discovery, not merely delisted.
        visibleInDirectory: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        availabilitySlots: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
    }

    const reviews = await prisma.review.findMany({
      where: { cleanerId: params.id, visibility: 'VISIBLE' },
      include: {
        client: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const imageUrl = await resolveProfileImageUrl(profile.user.image);

    return NextResponse.json({
      id: profile.user.id,
      name: profile.user.name,
      image: imageUrl,
      bio: profile.bio,
      hourlyRateRegular: Number(profile.hourlyRateRegular),
      specialties: profile.specialties,
      tier: profile.tier.toLowerCase(),
      verified: profile.verified,
      backgroundCheckPassed: profile.backgroundCheckPassed,
      location: profile.location,
      availableNow: profile.availableNow,
      completedJobs: profile.completedJobs,
      rating: Number(profile.rating),
      availabilitySlots: profile.availabilitySlots,
      reviews,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
