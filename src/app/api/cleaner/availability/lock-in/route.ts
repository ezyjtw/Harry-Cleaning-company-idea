import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      availabilitySlots: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { startDate, endDate } = body;

  if (
    !startDate ||
    !endDate ||
    !DATE_REGEX.test(startDate) ||
    !DATE_REGEX.test(endDate) ||
    startDate > endDate
  ) {
    return NextResponse.json(
      { error: 'startDate and endDate required in YYYY-MM-DD format, startDate <= endDate' },
      { status: 400 }
    );
  }

  const slotsByDow = new Map<number, Array<{ startTime: string; endTime: string }>>();
  for (const slot of profile.availabilitySlots) {
    const existing = slotsByDow.get(slot.dayOfWeek) || [];
    existing.push({ startTime: slot.startTime, endTime: slot.endTime });
    slotsByDow.set(slot.dayOfWeek, existing);
  }

  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const datesToProcess: Array<{ date: Date; dayOfWeek: number }> = [];
  while (current <= end) {
    datesToProcess.push({ date: new Date(current), dayOfWeek: current.getDay() });
    current.setDate(current.getDate() + 1);
  }

  const existingDateSlots = await prisma.availabilityDateSlot.findMany({
    where: {
      cleanerProfileId: profile.id,
      date: { in: datesToProcess.map((d) => new Date(toDateStr(d.date))) },
    },
    select: { date: true },
  });

  const existingDates = new Set(existingDateSlots.map((ds) => toDateStr(ds.date)));

  const newSlots: Array<{
    cleanerProfileId: string;
    date: Date;
    startTime: string;
    endTime: string;
  }> = [];

  for (const { date, dayOfWeek } of datesToProcess) {
    const dateStr = toDateStr(date);
    if (existingDates.has(dateStr)) continue;

    const templateSlots = slotsByDow.get(dayOfWeek) || [];
    for (const slot of templateSlots) {
      newSlots.push({
        cleanerProfileId: profile.id,
        date: new Date(dateStr),
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }

  if (newSlots.length > 0) {
    await prisma.availabilityDateSlot.createMany({ data: newSlots });
  }

  return NextResponse.json({
    success: true,
    lockedInDates: datesToProcess.length,
    skippedDates: existingDates.size,
    slotsCreated: newSlots.length,
  });
}
