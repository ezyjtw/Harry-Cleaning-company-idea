import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Types ──────────────────────────────────────────────

interface TimeSlot {
  start: string; // e.g. "09:00"
  end: string; // e.g. "17:00"
}

interface WeeklySlots {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

interface AvailabilityData {
  cleanerId: string;
  weeklySlots: WeeklySlots;
  blockedDates: string[]; // ISO date strings
}

// ─── Validation ─────────────────────────────────────────

const VALID_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
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

// ─── Mock data ──────────────────────────────────────────

const mockAvailability: AvailabilityData = {
  cleanerId: 'cleaner-001',
  weeklySlots: {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '13:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
    saturday: [{ start: '10:00', end: '14:00' }],
    sunday: [],
  },
  blockedDates: ['2026-03-25', '2026-04-01', '2026-04-10'],
};

// ─── GET /api/cleaner/availability ──────────────────────

export async function GET() {
  // In production, authenticate and fetch from Prisma based on session
  return NextResponse.json(mockAvailability);
}

// ─── PUT /api/cleaner/availability ──────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { weeklySlots, blockedDates } = body;

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

      // Check for unexpected day keys
      const providedDays = Object.keys(weeklySlots);
      const invalidDays = providedDays.filter(
        (d) => !(VALID_DAYS as readonly string[]).includes(d)
      );
      if (invalidDays.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid day(s): ${invalidDays.join(', ')}. Valid days are: ${VALID_DAYS.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate blockedDates
    if (blockedDates !== undefined) {
      if (!Array.isArray(blockedDates)) {
        return NextResponse.json(
          { error: 'blockedDates must be an array of date strings (YYYY-MM-DD)' },
          { status: 400 }
        );
      }

      for (const date of blockedDates) {
        if (typeof date !== 'string' || !DATE_REGEX.test(date)) {
          return NextResponse.json(
            { error: `Invalid date format: "${date}". Use YYYY-MM-DD.` },
            { status: 400 }
          );
        }
      }
    }

    // In production, update via Prisma:
    // await prisma.cleanerAvailability.update({
    //   where: { cleanerId: session.user.cleanerId },
    //   data: { weeklySlots, blockedDates },
    // });

    const updatedAvailability: AvailabilityData = {
      cleanerId: mockAvailability.cleanerId,
      weeklySlots: weeklySlots
        ? { ...mockAvailability.weeklySlots, ...weeklySlots }
        : mockAvailability.weeklySlots,
      blockedDates: blockedDates ?? mockAvailability.blockedDates,
    };

    // eslint-disable-next-line no-console
    console.log('[Availability] Updated:', updatedAvailability);

    return NextResponse.json({
      success: true,
      availability: updatedAvailability,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Availability] Update error:', error);
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 });
  }
}
