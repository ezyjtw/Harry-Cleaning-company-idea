import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

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
            hourlyRate: true,
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

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
