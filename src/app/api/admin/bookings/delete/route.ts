import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { ADMIN_DESTRUCTIVE_ENABLED } from '@/lib/config/features';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

export async function POST(request: NextRequest) {
  if (!ADMIN_DESTRUCTIVE_ENABLED) {
    return NextResponse.json({ error: 'Destructive admin actions are disabled' }, { status: 403 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: { select: { id: true } },
      refundRecords: { select: { id: true, amount: true, status: true } },
      topupRecords: { select: { id: true, amount: true, status: true } },
      review: { select: { id: true } },
      dispute: { select: { id: true } },
      bookingAddons: { select: { id: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const snapshot = {
    bookingId: booking.id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    transferStatus: booking.transferStatus,
    totalPrice: Number(booking.totalPrice),
    cleanerEarnings: Number(booking.cleanerEarnings),
    platformFee: Number(booking.platformFee),
    clientId: booking.clientId,
    cleanerId: booking.cleanerId,
    serviceType: booking.serviceType,
    date: booking.date?.toISOString() ?? null,
    stripePaymentIntentId: booking.stripePaymentIntentId,
    stripeTransferId: booking.stripeTransferId,
    relations: {
      payment: booking.payment ? 1 : 0,
      refundRecords: booking.refundRecords.length,
      topupRecords: booking.topupRecords.length,
      review: booking.review ? 1 : 0,
      dispute: booking.dispute ? 1 : 0,
      addons: booking.bookingAddons.length,
    },
    refundSummary: booking.refundRecords.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      status: r.status,
    })),
    topupSummary: booking.topupRecords.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      status: t.status,
    })),
  };

  await AuditService.log({
    userId: admin.id,
    action: 'ADMIN_DELETE_BOOKING',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: snapshot,
  });

  await prisma.$transaction([
    prisma.bookingAddon.deleteMany({ where: { bookingId } }),
    prisma.booking.delete({ where: { id: bookingId } }),
  ]);

  return NextResponse.json({ deleted: true, snapshot });
}
