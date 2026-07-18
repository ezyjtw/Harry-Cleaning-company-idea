import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { acceptWithReconciliation } from '@/lib/services/reconciliation.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      cleanerId: true,
      clientId: true,
      serviceType: true,
      propertySize: true,
      duration: true,
      totalPrice: true,
      cleanerEarnings: true,
      platformFee: true,
      extras: true,
      stripePaymentIntentId: true,
      date: true,
      startTime: true,
      cascadeExpiresAt: true,
      cascadeBackupExpiresAt: true,
      cascadePhase: true,
      client: { select: { email: true, name: true, stripeCustomerId: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const result = await acceptWithReconciliation(id, user.id, {
    cleanerId: booking.cleanerId,
    clientId: booking.clientId,
    serviceType: booking.serviceType,
    propertySize: booking.propertySize,
    duration: Number(booking.duration),
    totalPrice: Number(booking.totalPrice),
    cleanerEarnings: Number(booking.cleanerEarnings),
    platformFee: Number(booking.platformFee),
    extras: booking.extras,
    stripePaymentIntentId: booking.stripePaymentIntentId,
    date: booking.date,
    startTime: booking.startTime,
    clientEmail: booking.client?.email ?? null,
    clientName: booking.client?.name ?? null,
    stripeCustomerId: booking.client?.stripeCustomerId ?? null,
    cascadeExpiresAt: booking.cascadeExpiresAt,
    cascadeBackupExpiresAt: booking.cascadeBackupExpiresAt,
    cascadePhase: booking.cascadePhase,
  });

  if (result.outcome === 'FAILED') {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  if (result.outcome === 'REJECTED') {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  // CONFIRMED or CONFIRMED_WITH_REFUND — notify customer
  if (result.outcome === 'CONFIRMED' || result.outcome === 'CONFIRMED_WITH_REFUND') {
    const accepted = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        cleaner: { select: { name: true } },
      },
    });

    if (accepted?.clientId) {
      await prisma.notification
        .create({
          data: {
            userId: accepted.clientId,
            type: 'BOOKING_CONFIRMED',
            title: 'Booking accepted',
            body: `Good news — ${accepted.cleaner?.name ?? 'your cleaner'} has taken your booking for ${accepted.date.toLocaleDateString('en-GB')}.`,
            data: { bookingId: accepted.id },
          },
        })
        .catch(() => {});
    }
  }

  // PROVISIONAL — customer will be notified via email to approve
  if (result.outcome === 'PROVISIONAL') {
    return NextResponse.json({
      message: 'Provisional acceptance — customer approval required for price difference',
      job: { id, status: 'PROVISIONAL' },
      outcome: result.outcome,
    });
  }

  // RESERVED — held as a Phase 2 reserve; promoted only if no cheaper cleaner accepts
  if (result.outcome === 'RESERVED') {
    return NextResponse.json({
      message:
        "You're held in reserve. If no cleaner accepts at or below the quoted price, we'll be in touch about this job.",
      job: { id, status: 'RESERVED' },
      outcome: result.outcome,
    });
  }

  return NextResponse.json({
    message: 'Job accepted',
    job: { id, status: 'ACCEPTED' },
    outcome: result.outcome,
  });
}
