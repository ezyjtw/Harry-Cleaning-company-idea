import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        address: true,
        cleaner: {
          select: {
            id: true,
            name: true,
            image: true,
            phone: true,
            cleanerProfile: {
              select: {
                rating: true,
                completedJobs: true,
                tier: true,
              },
            },
          },
        },
        client: {
          select: { id: true, name: true, image: true, phone: true },
        },
        review: true,
        payment: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Only allow the client, cleaner, or admin to view
    const isClient = booking.clientId === user.id;
    const isCleaner = booking.cleanerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isClient && !isCleaner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    return NextResponse.json({
      ...booking,
      cleaner: booking.cleaner
        ? { ...booking.cleaner, image: await resolveProfileImageUrl(booking.cleaner.image) }
        : booking.cleaner,
      client: booking.client
        ? { ...booking.client, image: await resolveProfileImageUrl(booking.client.image) }
        : booking.client,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
