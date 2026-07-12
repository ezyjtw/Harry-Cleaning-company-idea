import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Name casing heals on save (shared helper).
    if (body.name !== undefined) updateData.name = displayName(String(body.name));
    if (body.phone !== undefined) updateData.phone = body.phone;

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true, image: true },
    });

    return NextResponse.json({
      ...user,
      image: await resolveProfileImageUrl(user.image),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        cleanerProfile: {
          select: {
            id: true,
            bio: true,
            hourlyRateRegular: true,
            hourlyRateDeep: true,
            hourlyRateSameDay: true,
            specialties: true,
            tier: true,
            verified: true,
            rating: true,
            completedJobs: true,
            location: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      image: await resolveProfileImageUrl(user.image),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
