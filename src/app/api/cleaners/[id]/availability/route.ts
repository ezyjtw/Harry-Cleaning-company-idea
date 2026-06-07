import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface TimeRange {
  start: number;
  end: number;
}

function subtractRanges(available: TimeRange[], blocked: TimeRange[]): TimeRange[] {
  let result = [...available];
  for (const block of blocked) {
    const next: TimeRange[] = [];
    for (const range of result) {
      if (block.end <= range.start || block.start >= range.end) {
        next.push(range);
      } else {
        if (block.start > range.start) {
          next.push({ start: range.start, end: block.start });
        }
        if (block.end < range.end) {
          next.push({ start: block.end, end: range.end });
        }
      }
    }
    result = next;
  }
  return result;
}

function expandToSlots(ranges: TimeRange[], durationMins: number): string[] {
  const slots: string[] = [];
  for (const range of ranges) {
    let mins = range.start;
    while (mins + durationMins <= range.end) {
      slots.push(minutesToTime(mins));
      mins += 30;
    }
  }
  return slots;
}

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

  const [overrides, bookings] = await Promise.all([
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
        status: { notIn: ['CANCELLED'] },
      },
      select: { date: true, startTime: true, duration: true },
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

    const weeklyRanges = slotsByDow.get(dayOfWeek) || [];
    const hasWeeklySlots = weeklyRanges.length > 0;

    if (isPast || blockedDateSet.has(dateStr)) {
      dates.push({
        date: dateStr,
        dayOfWeek,
        availableSlotCount: 0,
        slots: [],
        isFullyBooked: isPast && hasWeeklySlots,
        isPast,
      });
      current.setDate(current.getDate() + 1);
      continue;
    }

    if (!hasWeeklySlots) {
      dates.push({
        date: dateStr,
        dayOfWeek,
        availableSlotCount: 0,
        slots: [],
        isFullyBooked: false,
        isPast: false,
      });
      current.setDate(current.getDate() + 1);
      continue;
    }

    const blockers: TimeRange[] = [
      ...(partialBlocks.get(dateStr) || []),
      ...(bookingBlocks.get(dateStr) || []),
    ];

    const openRanges = subtractRanges(weeklyRanges, blockers);
    const slots = expandToSlots(openRanges, durationMins);

    dates.push({
      date: dateStr,
      dayOfWeek,
      availableSlotCount: slots.length,
      slots,
      isFullyBooked: slots.length === 0,
      isPast: false,
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
