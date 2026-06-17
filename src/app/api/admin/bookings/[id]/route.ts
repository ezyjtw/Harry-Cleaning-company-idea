import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
      cleaner: {
        select: {
          id: true,
          name: true,
          email: true,
          cleanerProfile: {
            select: { stripeAccountId: true, verified: true, verificationStatus: true },
          },
        },
      },
      address: true,
      payment: true,
      refundRecords: { orderBy: { createdAt: 'desc' } },
      topupRecords: { orderBy: { createdAt: 'desc' } },
      review: true,
      dispute: { include: { evidence: true } },
      bookingAddons: { include: { addon: { select: { name: true, price: true } } } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}
