import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { applyCleanerTransition } from '@/lib/booking/cleaner-transition';
import { isAssignedTo, serializePreAccept } from '@/lib/booking/cleaner-view';
import { notOwnBookingWhere, paidVisibleWhere } from '@/lib/booking/own-booking';
import { viewerQuote } from '@/lib/booking/viewer-quote';
import prisma from '@/lib/db/prisma';
import { mapBusy } from '@/lib/http/busy';
import { cleanerEarningsBreakdown } from '@/lib/services/pricing.service';
import { getTransferAmountPence } from '@/lib/services/transfer-amount';
import { bookingFullAddress, bookingLine1, bookingPostcode } from '@/lib/utils/booking-address';
import { haversineDistance, lookupPostcode } from '@/lib/utils/postcode';

// B3: the transition map lives in src/lib/booking/transition.ts.

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      // H53: no payment → no visibility. A cleaner can't open an unpaid booking.
      ...paidVisibleWhere(),
      // H38: own customer purchase never opens through the job door.
      AND: [
        notOwnBookingWhere(user.id),
        {
          OR: [
            { cleanerId: user.id },
            {
              backupCleanerIds: { has: user.id },
              cascadePhase: { in: ['BACKUP_OFFER', 'COMBINED_OFFER', 'RENA_FIND'] },
            },
          ],
        },
      ],
      NOT: { declinedCleanerIds: { has: user.id } },
    },
    include: {
      client: { select: { name: true, email: true } },
      address: true,
      // F24.1: occurrences must be visibly recurring on every surface.
      agreement: { select: { frequency: true, cleanerId: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // B3: offer context — "~25 min from home · your Tuesday is free".
  // Half 1: viewer's home point (CleanerProfile.latitude/longitude, dual-written
  // from homePostcode) → job postcode centroid (postcodes.io, 24h-cached) →
  // haversine miles at the crow-flies 25 mph convention → minutes. Null if
  // either point is unavailable (the UI simply omits that half).
  // Half 2: the viewer's other ACTIVE jobs on the offer's date (count).
  let travelMinutes: number | null = null;
  let sameDayJobs = 0;
  if (booking.status === 'AWAITING_CLEANER') {
    try {
      const [profile, geo, dayCount] = await Promise.all([
        prisma.cleanerProfile.findFirst({
          where: { userId: user.id },
          select: { latitude: true, longitude: true },
        }),
        lookupPostcode(bookingPostcode(booking) || ''),
        prisma.booking.count({
          where: {
            cleanerId: user.id,
            date: booking.date,
            status: { in: ['ACCEPTED', 'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS'] },
          },
        }),
      ]);
      sameDayJobs = dayCount;
      if (
        profile?.latitude !== null &&
        profile?.latitude !== undefined &&
        profile?.longitude !== null &&
        profile?.longitude !== undefined &&
        geo
      ) {
        const miles = haversineDistance(
          profile.latitude,
          profile.longitude,
          geo.latitude,
          geo.longitude
        );
        travelMinutes = Math.max(5, Math.round((miles / 25) * 60));
      }
    } catch {
      /* context is decorative — never block the offer on it */
    }
  }

  // B3 (RENA-026): before assignment the ONE serializer decides the payload —
  // first name, outward code and town, the viewer's own figure, the
  // documented context; never the email, surname, street, notes, key access
  // or payment status.
  if (!isAssignedTo(booking, user.id)) {
    const quote =
      booking.cleanerId === user.id
        ? { viewerEarnings: null, viewerBreakdown: null }
        : await viewerQuote(booking, user.id);
    return NextResponse.json({
      job: serializePreAccept(booking, user.id, {
        ...quote,
        storedBreakdown: cleanerEarningsBreakdown({
          serviceType: booking.serviceType,
          customerSubtotal: booking.customerSubtotal,
          cleanerEarnings: Number(booking.cleanerEarnings),
          extras: booking.extras,
        }),
        context: { travelMinutes, sameDayJobs },
      }),
    });
  }

  return NextResponse.json({
    job: {
      id: booking.id,
      status: booking.status,
      // H104: server-side authz truth — full guidance renders only for the
      // ASSIGNED cleaner post-accept; offered cleaners get the sanitised view.
      assigned:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED',
      // Offer-cascade fields (Rena Pro Offer screen: window countdown + accept routing).
      cascadePhase: booking.cascadePhase,
      cascadeExpiresAt: booking.cascadeExpiresAt ? booking.cascadeExpiresAt.toISOString() : null,
      clientName: booking.client?.name || booking.guestName || 'Guest',
      clientEmail: booking.client?.email || booking.guestEmail || '',
      // A12: read from booking columns (legacy relation fallback in helper).
      address:
        booking.status === 'PENDING' || booking.status === 'AWAITING_CLEANER'
          ? bookingPostcode(booking) || 'TBD'
          : `${bookingLine1(booking)}, ${bookingPostcode(booking)}`,
      fullAddress:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? bookingFullAddress(booking)
          : undefined,
      postcode: bookingPostcode(booking),
      date: booking.date.toISOString().split('T')[0],
      time: booking.startTime,
      duration: Number(booking.duration),
      serviceType: booking.serviceType,
      // F24.1: non-null frequency marks a recurring occurrence.
      recurringFrequency: booking.agreement?.frequency ?? null,
      // F24.3: the customer total (6%-inclusive) is not the cleaner's business
      // and no longer rides this payload.
      // H104 money law: the figure shown is THE payout function's figure —
      // getTransferAmountPence is the single source of the transfer amount.
      cleanerEarnings: getTransferAmountPence(Number(booking.cleanerEarnings)) / 100,
      paymentStatus: booking.paymentStatus,
      // H104: customer guidance is assigned-cleaner-only — SERVER-side, not UI
      // hiding. Pre-accept offer recipients get none of it.
      notes:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? booking.notes
          : undefined,
      keyAccess:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? ((booking.rooms as Record<string, unknown>)?.keyAccess as string | undefined)
          : undefined,
      keyAccessNote:
        booking.cleanerId === user.id &&
        booking.status !== 'PENDING' &&
        booking.status !== 'AWAITING_CLEANER' &&
        booking.status !== 'CASCADE_EXHAUSTED'
          ? ((booking.rooms as Record<string, unknown>)?.keyAccessNote as string | undefined)
          : undefined,
      cleanerNotes: booking.cleanerNotes,
      // F12: cascade-state copy for the decline confirm ("offered to backups"
      // vs "we'll find the customer another cleaner"). A boolean, no ids.
      hasBackups: booking.backupCleanerIds.length > 0,
      // LB-7: supplies is DECISION-relevant, not sensitive — a cleaner without
      // a kit can't take a bring-your-own job. Unlike address/notes it is in
      // the sanitised PRE-ACCEPT safe set, alongside date/time/area/pay.
      suppliesProvided: booking.suppliesProvided,
      bedrooms: (booking.rooms as Record<string, unknown>)?.bedrooms as number | undefined,
      extras: booking.extras,
      createdAt: booking.createdAt.toISOString(),
      context: { travelMinutes, sameDayJobs },
    },
  });
}

// B3 gate: a cleaner-lock wait past the transaction budget answers 503 BUSY.
export const PATCH = mapBusy(async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { status, notes, cancellationReason } = body;

  if (!status || typeof status !== 'string') {
    const exists = await prisma.booking.findFirst({
      where: { id, cleanerId: user.id },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  // B3 (RENA-028, RENA-027, RENA-032): every move is a CAS inside its D-f
  // window — TOO_EARLY 422 { error, target, opensAt }, STATE_CHANGED 409
  // { error, hint: 'refetch' } — and the side effects run only for the
  // writer that won.
  const result = await applyCleanerTransition({
    bookingId: id,
    cleanerId: user.id,
    to: status,
    notes,
    cancellationReason,
  });
  return NextResponse.json(result.body, { status: result.status });
});
