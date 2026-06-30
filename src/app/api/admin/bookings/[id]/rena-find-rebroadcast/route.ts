import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { MatchingService } from '@/lib/services/matching.service';

const HOUR_MS = 60 * 60 * 1000;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const adminFloor = typeof body.ratingFloor === 'number' ? body.ratingFloor : -Infinity;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      status: true,
      cascadePhase: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
      clientId: true,
      cleanerId: true,
      backupCleanerIds: true,
      declinedCleanerIds: true,
      cleanerEarnings: true,
      addressPostcode: true, // A12: postcode now on the booking
      address: { select: { postcode: true } }, // legacy fallback
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.cascadePhase !== 'RENA_FIND_ADMIN_REVIEW') {
    return NextResponse.json(
      { error: 'Booking is not in Rena-find admin review' },
      { status: 400 }
    );
  }

  const postcode = booking.addressPostcode || booking.address?.postcode;
  if (!postcode) {
    return NextResponse.json({ error: 'No postcode on booking' }, { status: 400 });
  }

  const now = new Date();
  const parts = booking.startTime.split(':');
  const slotStart = new Date(booking.date);
  slotStart.setUTCHours(Number(parts[0]), Number(parts[1] ?? 0), 0, 0);
  if (slotStart.getTime() <= now.getTime()) {
    return NextResponse.json({ error: 'Slot has already passed' }, { status: 400 });
  }

  const excludeSet = new Set([
    booking.cleanerId,
    ...booking.backupCleanerIds,
    ...(booking.declinedCleanerIds ?? []),
  ]);

  const matchResult = await MatchingService.findMatches({
    date: booking.date,
    startTime: booking.startTime,
    duration: Number(booking.duration),
    serviceType: booking.serviceType,
    postcode,
    clientId: booking.clientId ?? undefined,
  });

  const eligible = matchResult.matches.filter((m) => m.isAvailable && !excludeSet.has(m.userId));
  const qualified = eligible.filter((m) => m.rating >= adminFloor);

  // Preview mode: return candidate info without broadcasting
  if (body.preview === true) {
    return NextResponse.json({
      candidateCount: qualified.length,
      candidates: qualified.map((m) => ({
        name: m.name,
        rating: m.rating,
        distanceKm: m.distanceKm,
      })),
      belowFloorCount: eligible.length - qualified.length,
    });
  }

  const qualifiedIds = qualified.map((m) => m.userId);

  if (qualifiedIds.length === 0) {
    return NextResponse.json(
      {
        error: 'No candidates found above the specified floor',
        belowFloorCount: eligible.length,
      },
      { status: 404 }
    );
  }

  const resolveBy = new Date(slotStart.getTime() - 24 * HOUR_MS);
  const runwayMs = resolveBy.getTime() - now.getTime();
  const expiresAt = runwayMs > 0 ? resolveBy : new Date(now.getTime() + 12 * HOUR_MS);

  const result = await prisma.booking.updateMany({
    where: {
      id,
      status: 'AWAITING_CLEANER',
      cascadePhase: 'RENA_FIND_ADMIN_REVIEW',
    },
    data: {
      cascadePhase: 'RENA_FIND',
      cascadeExpiresAt: expiresAt,
      cascadeBackupExpiresAt: null,
      backupCleanerIds: qualifiedIds,
      declinedCleanerIds: [],
      reserveCleanerIds: [],
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Booking state changed' }, { status: 409 });
  }

  const earnings = `£${Number(booking.cleanerEarnings).toFixed(2)}`;
  for (const cleanerId of qualifiedIds) {
    await prisma.notification
      .create({
        data: {
          userId: cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${booking.serviceType} job is available for ${earnings} — first to accept gets it.`,
          data: { bookingId: id },
        },
      })
      .catch(() => {});
  }

  await AuditService.log({
    action: 'ADMIN_FORCE_CASCADE',
    userId: admin.id,
    entityType: 'Booking',
    entityId: id,
    metadata: {
      fromPhase: 'RENA_FIND_ADMIN_REVIEW',
      toPhase: 'RENA_FIND',
      ratingFloor: adminFloor === -Infinity ? null : adminFloor,
      candidateCount: qualifiedIds.length,
    },
  }).catch(() => {});

  return NextResponse.json({
    status: 'rebroadcast',
    candidateCount: qualifiedIds.length,
    expiresAt: expiresAt.toISOString(),
  });
}
