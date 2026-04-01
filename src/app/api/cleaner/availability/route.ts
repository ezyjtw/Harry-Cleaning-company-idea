import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

interface TimeSlot {
  start: string;
  end: string;
}

type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const VALID_DAYS: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_TO_NUMBER: Record<DayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NUMBER_TO_DAY: Record<number, DayName> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimeSlot(slot: unknown): slot is TimeSlot {
  if (!slot || typeof slot !== 'object') return false;
  const s = slot as Record<string, unknown>;
  return (
    typeof s.start === 'string' &&
    typeof s.end === 'string' &&
    TIME_REGEX.test(s.start) &&
    TIME_REGEX.test(s.end) &&
    s.start < s.end
  );
}

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    include: {
      availabilitySlots: true,
      availabilityOverrides: { where: { isBlocked: true }, orderBy: { date: 'asc' } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Build weekly slots from DB
  const weeklySlots: Record<DayName, TimeSlot[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  for (const slot of profile.availabilitySlots) {
    const dayName = NUMBER_TO_DAY[slot.dayOfWeek];
    if (dayName) {
      weeklySlots[dayName].push({ start: slot.startTime, end: slot.endTime });
    }
  }

  // Build blocked dates
  const blockedDates = profile.availabilityOverrides.map((o) => ({
    date: o.date.toISOString().split('T')[0],
    reason: o.reason || '',
  }));

  return NextResponse.json({
    cleanerId: user.id,
    availableNow: profile.availableNow,
    weeklySlots,
    blockedDates,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { weeklySlots, blockedDates, availableNow } = body;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Handle availableNow toggle (simple update)
  if (typeof availableNow === 'boolean' && !weeklySlots && !blockedDates) {
    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: { availableNow },
    });
    return NextResponse.json({ success: true });
  }

  // Validate weeklySlots
  if (weeklySlots) {
    if (typeof weeklySlots !== 'object') {
      return NextResponse.json({ error: 'weeklySlots must be an object' }, { status: 400 });
    }

    for (const day of VALID_DAYS) {
      if (weeklySlots[day] !== undefined) {
        if (!Array.isArray(weeklySlots[day])) {
          return NextResponse.json(
            { error: `weeklySlots.${day} must be an array of time slots` },
            { status: 400 }
          );
        }
        for (const slot of weeklySlots[day]) {
          if (!isValidTimeSlot(slot)) {
            return NextResponse.json(
              {
                error: `Invalid time slot in ${day}. Each slot must have start and end in HH:MM format, with start before end.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }
  }

  // Validate blockedDates
  if (blockedDates !== undefined) {
    if (!Array.isArray(blockedDates)) {
      return NextResponse.json({ error: 'blockedDates must be an array' }, { status: 400 });
    }
    for (const entry of blockedDates) {
      const dateStr = typeof entry === 'string' ? entry : entry?.date;
      if (!dateStr || !DATE_REGEX.test(dateStr)) {
        return NextResponse.json(
          { error: `Invalid date format. Use YYYY-MM-DD.` },
          { status: 400 }
        );
      }
    }
  }

  // Use a transaction to update slots and overrides
  await prisma.$transaction(async (tx) => {
    if (weeklySlots) {
      // Delete existing slots
      await tx.availabilitySlot.deleteMany({
        where: { cleanerProfileId: profile.id },
      });

      // Create new slots
      const slotData: Array<{
        cleanerProfileId: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }> = [];

      for (const day of VALID_DAYS) {
        const slots = weeklySlots[day];
        if (Array.isArray(slots)) {
          for (const slot of slots) {
            slotData.push({
              cleanerProfileId: profile.id,
              dayOfWeek: DAY_TO_NUMBER[day],
              startTime: slot.start,
              endTime: slot.end,
            });
          }
        }
      }

      if (slotData.length > 0) {
        await tx.availabilitySlot.createMany({ data: slotData });
      }
    }

    if (blockedDates !== undefined) {
      // Delete existing overrides
      await tx.availabilityOverride.deleteMany({
        where: { cleanerProfileId: profile.id },
      });

      // Create new blocked dates
      const overrideData = blockedDates.map((entry: string | { date: string; reason?: string }) => {
        const dateStr = typeof entry === 'string' ? entry : entry.date;
        const reason = typeof entry === 'object' ? entry.reason : undefined;
        return {
          cleanerProfileId: profile.id,
          date: new Date(dateStr),
          isBlocked: true,
          reason: reason || null,
        };
      });

      if (overrideData.length > 0) {
        await tx.availabilityOverride.createMany({ data: overrideData });
      }
    }

    if (typeof availableNow === 'boolean') {
      await tx.cleanerProfile.update({
        where: { id: profile.id },
        data: { availableNow },
      });
    }
  });

  return NextResponse.json({ success: true });
}
