// B3 (RENA-028, deviation 8 ruled): the ONE cleaner accept. The accept route
// and the jobs PATCH's legacy ACCEPTED branch both call this, so the PATCH no
// longer skips price reconciliation. Moved verbatim from the accept route;
// the CONFIRMED fork now claims through the assignment helper.

import { assignCleaner } from '@/lib/booking/assign';
import prisma from '@/lib/db/prisma';
import { acceptWithReconciliation } from '@/lib/services/reconciliation.service';

export interface AcceptReply {
  status: number;
  body: Record<string, unknown>;
}

function reply(body: Record<string, unknown>, init?: { status?: number }): AcceptReply {
  return { status: init?.status ?? 200, body };
}

export async function acceptOfferAsCleaner(id: string, userId: string): Promise<AcceptReply> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      status: true,
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
    return reply({ error: 'Booking not found' }, { status: 404 });
  }

  // 4a (James-ruled, Option 1): a CONFIRMED booking is this cleaner's own
  // pinned, admin-placed job — no live offer, no cascade, nothing for
  // reconciliation to price — so the atomicAccept inside
  // acceptWithReconciliation would 409 it. Same EXPLICIT fork as the PATCH
  // route: CONFIRMED-and-assigned-to-this-cleaner takes a plain guarded
  // status write (+ acceptedAt) and the same customer notification; every
  // other origin — the live-offer path included — routes through
  // reconciliation exactly as before. The guarded updateMany re-checks
  // status and ownership at write time, so a live offer can never land here.
  if (booking.status === 'CONFIRMED' && booking.cleanerId === userId) {
    // B3: through the assignment helper. CONFIRMED already holds this
    // cleaner's slot, so the move inside the blocking set cannot change I1.
    const claimed = await assignCleaner({
      bookingId: id,
      cleanerId: userId,
      expect: { status: 'CONFIRMED', cleanerId: userId },
      requireUnexpiredOffer: false,
      slotPolicy: 'skip',
      actor: { kind: 'CLEANER', id: userId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (!claimed.ok) {
      return reply({ error: 'Booking is no longer available' }, { status: 409 });
    }

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

    return reply({
      message: 'Job accepted',
      job: { id, status: 'ACCEPTED' },
      outcome: 'CONFIRMED',
    });
  }

  const result = await acceptWithReconciliation(id, userId, {
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
    return reply({ error: result.reason }, { status: 409 });
  }

  if (result.outcome === 'REJECTED') {
    return reply({ error: result.reason }, { status: 422 });
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
    return reply({
      message: 'Provisional acceptance — customer approval required for price difference',
      job: { id, status: 'PROVISIONAL' },
      outcome: result.outcome,
    });
  }

  // RESERVED — held as a Phase 2 reserve; promoted only if no cheaper cleaner accepts
  if (result.outcome === 'RESERVED') {
    return reply({
      message:
        "You're held in reserve. If no cleaner accepts at or below the quoted price, we'll be in touch about this job.",
      job: { id, status: 'RESERVED' },
      outcome: result.outcome,
    });
  }

  return reply({
    message: 'Job accepted',
    job: { id, status: 'ACCEPTED' },
    outcome: result.outcome,
  });
}
