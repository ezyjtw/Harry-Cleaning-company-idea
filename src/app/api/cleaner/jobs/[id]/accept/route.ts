import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { atomicAccept } from '@/lib/services/cascade.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await atomicAccept(id, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  const accepted = await prisma.booking.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  if (accepted?.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: accepted.clientId,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking accepted',
          body: `Your cleaner has accepted your booking for ${accepted.date.toLocaleDateString('en-GB')}.`,
          data: { bookingId: accepted.id },
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    message: 'Job accepted',
    job: { id, status: 'ACCEPTED' },
  });
}
