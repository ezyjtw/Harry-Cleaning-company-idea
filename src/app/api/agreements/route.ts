import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { displayName } from '@/lib/utils/name';

// R1-A: the session user's recurring agreements, both hats — as the customer
// (asClient) and as the cleaner (asCleaner). Each row carries its next
// scheduled occurrence so the surfaces can say "next clean: Tue 3 Mar".
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agreements = await prisma.recurringAgreement.findMany({
    where: { OR: [{ clientId: user.id }, { cleanerId: user.id }] },
    include: {
      cleaner: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      bookings: {
        // R1-C: the NEXT occurrence — SCHEDULED (uncharged) or a paid one
        // (ACCEPTED after its T-48h charge) — so the skip action can target it.
        where: {
          OR: [
            { status: 'SCHEDULED' },
            { status: { in: ['ACCEPTED', 'CONFIRMED'] }, paymentStatus: 'SUCCEEDED' },
          ],
          date: { gte: new Date() },
        },
        select: { id: true, date: true, startTime: true, paymentStatus: true },
        orderBy: { date: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const shape = (a: (typeof agreements)[number]) => ({
    id: a.id,
    role: a.cleanerId === user.id ? ('CLEANER' as const) : ('CUSTOMER' as const),
    status: a.status,
    frequency: a.frequency,
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    duration: Number(a.duration),
    serviceType: a.serviceType,
    // Name of the OTHER party, from this viewer's seat.
    otherPartyName:
      a.cleanerId === user.id
        ? displayName(a.client?.name) || displayName(a.guestName) || 'Customer'
        : displayName(a.cleaner.name) || 'Your cleaner',
    // Money stays seat-appropriate: customers see the price they pay,
    // cleaners see their net (net-first law).
    amount: a.cleanerId === user.id ? Number(a.cleanerEarnings) : Number(a.totalPrice),
    nextOccurrence: a.bookings[0]?.date.toISOString().split('T')[0] ?? null,
    nextOccurrenceId: a.bookings[0]?.id ?? null,
    nextOccurrenceTime: a.bookings[0]?.startTime ?? null,
    nextOccurrencePaid: a.bookings[0]?.paymentStatus === 'SUCCEEDED',
    endedAt: a.endedAt?.toISOString() ?? null,
    endedBy: a.endedBy,
    createdAt: a.createdAt.toISOString(),
  });

  return NextResponse.json({
    asCustomer: agreements.filter((a) => a.clientId === user.id).map(shape),
    asCleaner: agreements.filter((a) => a.cleanerId === user.id).map(shape),
  });
}
