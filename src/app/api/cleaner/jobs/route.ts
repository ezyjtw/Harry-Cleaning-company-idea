import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // comma-separated statuses
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const where: Record<string, unknown> = { cleanerId: user.id };

  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s) => s.trim().toUpperCase());
    where.status = { in: statuses };
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        client: { select: { name: true } },
        address: { select: { line1: true, city: true, postcode: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return NextResponse.json({
    jobs: bookings.map((b) => ({
      id: b.id,
      clientName: b.client?.name || b.guestName || 'Guest',
      address:
        b.status === 'PENDING'
          ? b.address?.postcode || 'TBD'
          : `${b.address?.line1 || ''}, ${b.address?.postcode || ''}`,
      fullAddress: `${b.address?.line1 || ''}, ${b.address?.city || ''} ${b.address?.postcode || ''}`,
      date: b.date.toISOString().split('T')[0],
      time: b.startTime,
      serviceType: b.serviceType,
      totalPrice: Number(b.totalPrice),
      cleanerEarnings: Number(b.cleanerEarnings),
      platformFee: Number(b.platformFee),
      status: b.status.toLowerCase(),
      duration: Number(b.duration),
      notes: b.notes,
      cleanerNotes: b.cleanerNotes,
      bedrooms: (b.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
      extras: b.extras,
    })),
    total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}
