import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: params.id },
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

    return NextResponse.json({
      id: profile.user.id,
      name: profile.user.name,
      image: profile.user.image,
      bio: profile.bio,
      hourlyRate: Number(profile.hourlyRate),
      specialties: profile.specialties,
      tier: profile.tier.toLowerCase(),
      verified: profile.verified,
      backgroundCheckPassed: profile.backgroundCheckPassed,
      location: profile.location,
      availableNow: profile.availableNow,
      responseTime: profile.responseTime ? `~${profile.responseTime} min` : null,
      completedJobs: profile.completedJobs,
      rating: Number(profile.rating),
      availabilitySlots: profile.availabilitySlots,
      reviews,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
