import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { blocksCleanerSlotWhere } from '@/lib/availability/slot-eligibility';
import {
  computeOpenRangesForDate,
  expandToSlots,
  timeToMinutes,
  toDateString,
  type TimeRange,
} from '@/lib/availability/timesheet';
import prisma from '@/lib/db/prisma';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cleanerUserId } = await params;

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const durationParam = searchParams.get('duration');

  if (!fromStr || !toStr || !DATE_REGEX.test(fromStr) || !DATE_REGEX.test(toStr)) {
    return NextResponse.json(
      { error: 'from and to query parameters required in YYYY-MM-DD format.' },
      { status: 400 }
    );
  }

  const duration = durationParam ? parseFloat(durationParam) : 2;
  if (duration < 1 || duration > 12) {
    return NextResponse.json(
      { error: 'duration must be between 1 and 12 hours.' },
      { status: 400 }
    );
  }

  const durationMins = duration * 60;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerUserId },
    select: {
      id: true,
      userId: true,
      bookingBufferMinutes: true,
      availabilitySlots: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
  }

  const bufferMins = profile.bookingBufferMinutes;

  const fromDate = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T23:59:59`);
  const todayStr = toDateString(new Date());

  const [overrides, bookings, dateSlots] = await Promise.all([
    prisma.availabilityOverride.findMany({
      where: {
        cleanerProfileId: profile.id,
        date: { gte: fromDate, lte: toDate },
        isBlocked: true,
      },
      select: { date: true, startTime: true, endTime: true },
    }),
    prisma.booking.findMany({
      where: {
        cleanerId: profile.userId,
        date: { gte: fromDate, lte: toDate },
        // H63: only committed work (or a live primary window) blocks the
        // customer-facing calendar.
        AND: [blocksCleanerSlotWhere()],
      },
      select: { date: true, startTime: true, duration: true },
    }),
    prisma.availabilityDateSlot.findMany({
      where: {
        cleanerProfileId: profile.id,
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true, startTime: true, endTime: true },
    }),
  ]);

  const blockedDateSet = new Set<string>();
  const partialBlocks = new Map<string, TimeRange[]>();

  for (const o of overrides) {
    const dateStr = toDateString(o.date);
    if (o.startTime && o.endTime) {
      const existing = partialBlocks.get(dateStr) || [];
      existing.push({ start: timeToMinutes(o.startTime), end: timeToMinutes(o.endTime) });
      partialBlocks.set(dateStr, existing);
    } else {
      blockedDateSet.add(dateStr);
    }
  }

  const bookingBlocks = new Map<string, TimeRange[]>();
  for (const b of bookings) {
    const dateStr = toDateString(b.date);
    const startMins = timeToMinutes(b.startTime);
    const durationBookingMins = Number(b.duration) * 60;
    const blockStart = startMins - bufferMins;
    const blockEnd = startMins + durationBookingMins + bufferMins;
    const existing = bookingBlocks.get(dateStr) || [];
    existing.push({ start: Math.max(0, blockStart), end: Math.min(1440, blockEnd) });
    bookingBlocks.set(dateStr, existing);
  }

  const slotsByDow = new Map<number, TimeRange[]>();
  for (const slot of profile.availabilitySlots) {
    const existing = slotsByDow.get(slot.dayOfWeek) || [];
    existing.push({ start: timeToMinutes(slot.startTime), end: timeToMinutes(slot.endTime) });
    slotsByDow.set(slot.dayOfWeek, existing);
  }

  const dateSpecificSlots = new Map<string, TimeRange[]>();
  for (const ds of dateSlots) {
    const dateStr = toDateString(ds.date);
    const existing = dateSpecificSlots.get(dateStr) || [];
    existing.push({ start: timeToMinutes(ds.startTime), end: timeToMinutes(ds.endTime) });
    dateSpecificSlots.set(dateStr, existing);
  }

  const dates: Array<{
    date: string;
    dayOfWeek: number;
    availableSlotCount: number;
    slots: string[];
    isFullyBooked: boolean;
    isPast: boolean;
  }> = [];

  const current = new Date(fromDate);
  current.setHours(12, 0, 0, 0);
  const endLoop = new Date(toDate);
  endLoop.setHours(12, 0, 0, 0);

  while (current <= endLoop) {
    const dateStr = toDateString(current);
    const dayOfWeek = current.getDay();
    const isPast = dateStr <= todayStr;

    const dateSpecific = dateSpecificSlots.get(dateStr) ?? null;
    const recurring = slotsByDow.get(dayOfWeek) ?? [];
    const fullDayBlocked = blockedDateSet.has(dateStr);
    const hasSlots = (dateSpecific ?? recurring).length > 0;

    const openRanges = computeOpenRangesForDate({
      dateSpecificRanges: dateSpecific,
      recurringRanges: recurring,
      fullDayBlocked,
      partialBlocks: partialBlocks.get(dateStr) ?? [],
      bookingBlocks: bookingBlocks.get(dateStr) ?? [],
      isPast,
    });
    const slots = expandToSlots(openRanges, durationMins);

    // Preserve the original isFullyBooked semantics exactly.
    let isFullyBooked: boolean;
    if (isPast || fullDayBlocked) isFullyBooked = isPast && hasSlots;
    else if (!hasSlots) isFullyBooked = false;
    else isFullyBooked = slots.length === 0;

    dates.push({
      date: dateStr,
      dayOfWeek,
      availableSlotCount: slots.length,
      slots,
      isFullyBooked,
      isPast,
    });

    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json({
    cleanerId: cleanerUserId,
    windowStart: fromStr,
    windowEnd: toStr,
    defaultDuration: duration,
    dates,
  });
}
