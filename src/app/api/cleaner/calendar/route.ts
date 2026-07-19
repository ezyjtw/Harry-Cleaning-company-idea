import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { computeCleanerOpenRanges, minutesToTime } from '@/lib/availability/timesheet';
import { notOwnBookingWhere, paidVisibleWhere } from '@/lib/booking/own-booking';
import prisma from '@/lib/db/prisma';
import { bookingPostcode } from '@/lib/utils/booking-address';
import { displayName } from '@/lib/utils/name';

// H56: the cleaner calendar's data — CONFIRMED work in a date range. This is
// the PLANNING surface: only bookings that WILL happen (accepted/confirmed/
// en-route). Offers never render here — accepting lives on the Jobs surface.
// Composes the standing read laws: paid-visible (H53) + never-own-purchase
// (H38).
//
// H56 polish: alongside bookings, each day carries the cleaner's OWN remaining
// availability (ghost fill) — the same computeCleanerOpenRanges core as H34,
// no new truth. Bookings subtract from open ranges (± the cleaner's buffer),
// so "Available 13:00–17:00" is what's genuinely left after the morning job.
export async function GET(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');
  if (
    !startStr ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startStr) ||
    !endStr ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endStr)
  ) {
    return NextResponse.json({ error: 'start and end (YYYY-MM-DD) are required' }, { status: 400 });
  }
  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T23:59:59.999Z`);
  const RANGE_CAP_MS = 62 * 86400000; // a month view + padding, never unbounded
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }
  if (end.getTime() - start.getTime() > RANGE_CAP_MS) {
    return NextResponse.json({ error: 'Range too large (max 62 days)' }, { status: 400 });
  }

  const cleanerProfileByUser = { cleanerProfile: { userId: user.id } };
  const [bookings, profile, recurringSlots, dateSlots, overrides] = await Promise.all([
    prisma.booking.findMany({
      where: {
        cleanerId: user.id,
        date: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'ACCEPTED', 'EN_ROUTE'] },
        ...paidVisibleWhere(),
        AND: [notOwnBookingWhere(user.id)],
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        duration: true,
        serviceType: true,
        status: true,
        cleanerEarnings: true,
        addressPostcode: true,
        client: { select: { name: true } },
        guestName: true,
        address: { select: { postcode: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 200,
    }),
    prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { bookingBufferMinutes: true },
    }),
    prisma.availabilitySlot.findMany({
      where: cleanerProfileByUser,
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    prisma.availabilityDateSlot.findMany({
      where: { ...cleanerProfileByUser, date: { gte: start, lte: end } },
      select: { date: true, startTime: true, endTime: true },
    }),
    prisma.availabilityOverride.findMany({
      where: { ...cleanerProfileByUser, date: { gte: start, lte: end }, isBlocked: true },
      select: { date: true, startTime: true, endTime: true },
    }),
  ]);

  // Per-day ghost availability. isPast is STRICTLY-before-today here (the H34
  // core's default treats today as past because a same-day slot isn't offerable
  // — but the cleaner's own calendar should still show today's remaining time).
  const todayYMD = new Date().toISOString().split('T')[0];
  const bufferMins = profile?.bookingBufferMinutes ?? 0;
  const days: Record<
    string,
    { openRanges: { start: string; end: string }[]; hasBaseSlots: boolean; fullDayBlocked: boolean }
  > = {};
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const targetDate = new Date(t);
    const ymd = targetDate.toISOString().split('T')[0];
    const { openRanges, hasBaseSlots, fullDayBlocked } = computeCleanerOpenRanges({
      targetDate,
      bufferMins,
      recurringSlots,
      dateSlots,
      overrides,
      bookings,
      isPast: ymd < todayYMD,
    });
    days[ymd] = {
      openRanges: openRanges.map((r) => ({
        start: minutesToTime(r.start),
        end: minutesToTime(r.end),
      })),
      hasBaseSlots,
      fullDayBlocked,
    };
  }

  return NextResponse.json({
    bookings: bookings.map((b) => {
      const fullName = displayName(b.client?.name) || displayName(b.guestName) || 'Customer';
      const postcode = bookingPostcode(b) || '';
      return {
        id: b.id,
        date: b.date.toISOString().split('T')[0],
        startTime: b.startTime,
        duration: Number(b.duration),
        serviceType: b.serviceType,
        status: b.status,
        // Net-first law: cleaner-facing money is their NET earnings.
        earnings: Number(b.cleanerEarnings),
        customerFirstName: fullName.split(' ')[0],
        // Postcode AREA only (outward code) — the calendar is a glance surface.
        postcodeArea: postcode.split(' ')[0] || '',
      };
    }),
    days,
  });
}
