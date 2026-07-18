import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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

    // Only allow the client, cleaner, backup cleaner, or admin to view
    const isClient = booking.clientId === user.id;
    const isCleaner = booking.cleanerId === user.id;
    const isBackup = booking.backupCleanerIds.includes(user.id);
    const isAdmin = user.role === 'ADMIN';

    if (!isClient && !isCleaner && !isBackup && !isAdmin) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    let backupCleanerNames: string[] = [];
    if (booking.backupCleanerIds.length > 0) {
      const backupUsers = await prisma.user.findMany({
        where: { id: { in: booking.backupCleanerIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(backupUsers.map((u) => [u.id, u.name || 'Cleaner']));
      backupCleanerNames = booking.backupCleanerIds.map((id) => nameMap.get(id) || 'Cleaner');
    }

    return NextResponse.json({
      ...booking,
      // H8: the page must know WHO is looking — rescue choices render for the
      // booking's customer only (UI hiding backed by the POST's own authz).
      viewer: isClient ? 'client' : isAdmin ? 'admin' : isCleaner ? 'cleaner' : 'backup',
      backupCleanerNames,
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
