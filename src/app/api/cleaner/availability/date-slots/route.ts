import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { date, slots } = body;

  if (!date || !DATE_REGEX.test(date)) {
    return NextResponse.json({ error: 'date required in YYYY-MM-DD format' }, { status: 400 });
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json(
      { error: 'slots must be a non-empty array of { startTime, endTime }' },
      { status: 400 }
    );
  }

  for (const slot of slots) {
    if (
      !slot.startTime ||
      !slot.endTime ||
      !TIME_REGEX.test(slot.startTime) ||
      !TIME_REGEX.test(slot.endTime) ||
      slot.startTime >= slot.endTime
    ) {
      return NextResponse.json(
        { error: 'Each slot must have startTime and endTime in HH:MM format with start < end' },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.availabilityDateSlot.deleteMany({
      where: { cleanerProfileId: profile.id, date: new Date(date) },
    });

    await tx.availabilityDateSlot.createMany({
      data: slots.map((slot: { startTime: string; endTime: string }) => ({
        cleanerProfileId: profile.id,
        date: new Date(date),
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    });
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { date } = body;

  if (!date || !DATE_REGEX.test(date)) {
    return NextResponse.json({ error: 'date required in YYYY-MM-DD format' }, { status: 400 });
  }

  await prisma.availabilityDateSlot.deleteMany({
    where: { cleanerProfileId: profile.id, date: new Date(date) },
  });

  return NextResponse.json({ success: true });
}
