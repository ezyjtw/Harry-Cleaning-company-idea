import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { STUCK_ADMIN_ACTION_MS } from '@/lib/services/stuck-jobs.service';

// Stuck-money reaper: the admin "Needs attention" queue — open cases first
// (oldest scheduled end first: the most-stuck money at the top), then a short
// tail of recently resolved ones for context.
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const now = Date.now();
  const [open, resolved] = await Promise.all([
    prisma.stuckJobCase.findMany({
      where: { resolvedAt: null },
      orderBy: { scheduledEndAt: 'asc' },
      include: {
        booking: {
          select: {
            id: true,
            serviceType: true,
            date: true,
            startTime: true,
            totalPrice: true,
            cleanerEarnings: true,
            status: true,
            guestName: true,
            guestEmail: true,
            client: { select: { name: true, email: true } },
            cleaner: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.stuckJobCase.findMany({
      where: { resolvedAt: { not: null } },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
      include: { booking: { select: { id: true, date: true, serviceType: true } } },
    }),
  ]);

  return NextResponse.json({
    open: open.map((c) => ({
      id: c.id,
      bookingId: c.bookingId,
      bookingRef: c.bookingId.substring(0, 8).toUpperCase(),
      serviceType: c.booking.serviceType,
      date: c.booking.date.toISOString(),
      startTime: c.booking.startTime,
      status: c.booking.status,
      totalPrice: Number(c.booking.totalPrice),
      cleanerEarnings: Number(c.booking.cleanerEarnings),
      customerName: c.booking.client?.name ?? c.booking.guestName ?? 'Guest',
      customerEmail: c.booking.client?.email ?? c.booking.guestEmail ?? null,
      isGuest: !c.booking.client,
      cleanerName: c.booking.cleaner?.name ?? 'Cleaner',
      scheduledEndAt: c.scheduledEndAt.toISOString(),
      daysStuck: Math.floor((now - c.scheduledEndAt.getTime()) / 86400000),
      nudge1At: c.nudge1At?.toISOString() ?? null,
      nudge2At: c.nudge2At?.toISOString() ?? null,
      customerAskedAt: c.customerAskedAt?.toISOString() ?? null,
      customerAnswer: c.customerAnswer,
      customerAnsweredAt: c.customerAnsweredAt?.toISOString() ?? null,
      // The money buttons arm at scheduled end + 5 days — the UI mirrors this
      // but the SERVICE enforces it; this flag is display truth only.
      actionsArmed: now > c.scheduledEndAt.getTime() + STUCK_ADMIN_ACTION_MS,
    })),
    resolved: resolved.map((c) => ({
      id: c.id,
      bookingRef: c.bookingId.substring(0, 8).toUpperCase(),
      serviceType: c.booking.serviceType,
      date: c.booking.date.toISOString(),
      resolution: c.resolution,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    })),
    count: open.length,
  });
}
