import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

// R1-A: the customer-facing picker for "Book a regular clean" — the weekly
// slots this cleaner has explicitly opened to regular clients. Public read,
// same exposure level as the availability calendar: day-of-week + times only,
// nothing personal.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: cleanerUserId } = await params;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerUserId },
    select: {
      availabilitySlots: {
        where: { recurringEligible: true },
        select: { dayOfWeek: true, startTime: true, endTime: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
  }

  return NextResponse.json({
    cleanerId: cleanerUserId,
    slots: profile.availabilitySlots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      start: s.startTime,
      end: s.endTime,
    })),
  });
}
