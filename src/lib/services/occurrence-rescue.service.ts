// R1-C (James-ruled): the last recurring leg — can't-make-it, holiday, skip.
// THE LAW: the cleaner proposes, the customer chooses — no unilateral edits.
// The AGREEMENT is untouched in every branch; everything here acts on ONE
// occurrence booking at a time (occurrences are bookings).
//
// Two variants, split by money state:
//   · PAID occurrence (ACCEPTED + SUCCEEDED): routes through the EXISTING
//     rescue machinery untouched — initiateCleanerCancelRescue → the three-way
//     panel (reschedule / cover via Rena-Find / full refund). Cover consent is
//     PER-INCIDENT by construction: the customer clicks it themselves.
//   · UNPAID SCHEDULED occurrence: no money has moved, so the funnel is the
//     same CLEANER_CANCELLED state with the no-charge variant — choices are
//     reschedule (stays SCHEDULED, charges at its new T-48h) or skip (nothing
//     charged). COVER IS SUPPRESSED pre-charge: the H53 law (unpaid work never
//     enters offer flows) outranks the three-way here — reported at the gate.
//
// R1-B interaction (named): any exit from SCHEDULED (CLEANER_CANCELLED,
// CANCELLED) structurally removes the row from the T-48h charge pool — the
// sweep filters on status='SCHEDULED' + paymentStatus='PENDING', so a clean
// being rescheduled can never be charged mid-flight.

import { prisma } from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

const RESCUE_WINDOW_MS = 48 * 60 * 60 * 1000;
const SKIP_FREE_CUTOFF_MS = 24 * 60 * 60 * 1000;

function occurrenceStart(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number);
  return new Date(date.getTime() + (h * 60 + m) * 60 * 1000);
}

export interface OccurrenceActionResult {
  ok: boolean;
  status: number;
  error?: string;
  variant?: 'paid' | 'unpaid';
  refunded?: boolean;
}

/** Cleaner: "Can't make this one" on a single occurrence. */
export async function cantMakeOccurrence(params: {
  bookingId: string;
  cleanerId: string;
  reason?: string;
  /** Holiday batching suppresses the per-booking email — ONE batch email per
   *  customer is sent by the caller instead. */
  suppressEmail?: boolean;
}): Promise<OccurrenceActionResult> {
  const { bookingId, cleanerId } = params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      agreementId: true,
      cleanerId: true,
      status: true,
      paymentStatus: true,
      date: true,
      startTime: true,
      clientId: true,
      guestEmail: true,
      guestName: true,
      guestToken: true,
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (!booking || !booking.agreementId) {
    return { ok: false, status: 404, error: 'Occurrence not found' };
  }
  if (booking.cleanerId !== cleanerId) {
    return { ok: false, status: 403, error: 'Not your occurrence' };
  }

  // PAID: the existing rescue machinery, untouched. The panel's three-way
  // (reschedule with you on another date / cover / full refund) is exactly the
  // ruled design; the agreement rides along untouched on the booking row.
  if (booking.paymentStatus === 'SUCCEEDED') {
    const { initiateCleanerCancelRescue } = await import('@/lib/services/rescue.service');
    const r = await initiateCleanerCancelRescue({
      bookingId,
      cleanerId,
      reason: params.reason?.trim() || "Cleaner can't make this occurrence",
      suppressEmail: params.suppressEmail,
    });
    if (!r.ok) return { ok: false, status: 409, error: r.reason };
    // eslint-disable-next-line no-console
    console.log(
      `[OccurrenceRescue] PAID occurrence ${bookingId} → rescue three-way (agreement untouched)`
    );
    return { ok: true, status: 200, variant: 'paid' };
  }

  // UNPAID SCHEDULED: same funnel state, no-charge variant. Exiting SCHEDULED
  // removes it from the T-48h charge pool structurally.
  if (booking.status !== 'SCHEDULED') {
    return {
      ok: false,
      status: 409,
      error: 'This occurrence cannot be flagged from its current state',
    };
  }
  const start = occurrenceStart(booking.date, booking.startTime);
  const deadline = new Date(Math.min(Date.now() + RESCUE_WINDOW_MS, start.getTime()));
  const claim = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'SCHEDULED' },
    data: {
      status: 'CLEANER_CANCELLED',
      cancelledByCleanerId: cleanerId,
      rescueDeadline: deadline.getTime() <= Date.now() ? new Date() : deadline,
      cancellationReason: params.reason?.trim() || "Cleaner can't make this occurrence",
    },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      status: 409,
      error: 'This occurrence was just resolved — check its status',
    };
  }
  // eslint-disable-next-line no-console
  console.log(
    `[OccurrenceRescue] UNPAID occurrence ${bookingId} → customer choice (reschedule/skip, nothing charged; agreement untouched)`
  );

  if (!params.suppressEmail) {
    const { sendOccurrenceCantMake } = await import('@/lib/services/email.service');
    await sendOccurrenceCantMake(bookingId).catch(() => {});
  }
  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'BOOKING_CANCELLED',
          title: "Your cleaner can't make one clean",
          body: 'Nothing has been charged. Pick a new date or skip this one — your regular arrangement is unaffected.',
          data: { bookingId, rescue: true },
        },
      })
      .catch(() => {});
  }
  return { ok: true, status: 200, variant: 'unpaid' };
}

/** Cleaner holiday: flag every occurrence in the range, across ALL their
 *  agreements — ONE batched email per affected customer. */
export async function holidayCantMake(params: {
  cleanerId: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string; // YYYY-MM-DD inclusive
}): Promise<{ ok: boolean; status: number; error?: string; flagged?: number; customers?: number }> {
  const start = new Date(`${params.startDate}T00:00:00.000Z`);
  const end = new Date(`${params.endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { ok: false, status: 400, error: 'Invalid date range' };
  }
  if (end.getTime() - start.getTime() > 92 * 86400000) {
    return { ok: false, status: 400, error: 'Range too large (max 92 days)' };
  }

  // Every occurrence of theirs in range still in a flaggable state.
  const occurrences = await prisma.booking.findMany({
    where: {
      cleanerId: params.cleanerId,
      agreementId: { not: null },
      date: { gte: start, lte: end },
      OR: [
        { status: 'SCHEDULED' },
        { status: { in: ['ACCEPTED', 'CONFIRMED'] }, paymentStatus: 'SUCCEEDED' },
      ],
    },
    select: {
      id: true,
      date: true,
      clientId: true,
      guestEmail: true,
    },
    orderBy: { date: 'asc' },
  });
  if (occurrences.length === 0) {
    return { ok: true, status: 200, flagged: 0, customers: 0 };
  }

  let flagged = 0;
  for (const occ of occurrences) {
    const r = await cantMakeOccurrence({
      bookingId: occ.id,
      cleanerId: params.cleanerId,
      reason: `Cleaner away ${params.startDate} to ${params.endDate}`,
      suppressEmail: true,
    });
    if (r.ok) flagged++;
  }

  // One batched email per customer (accounts keyed by clientId, guests by email).
  const byCustomer = new Map<string, string[]>();
  for (const occ of occurrences) {
    const key = occ.clientId ?? `guest:${(occ.guestEmail ?? '').toLowerCase()}`;
    byCustomer.set(key, [...(byCustomer.get(key) ?? []), occ.id]);
  }
  const { sendHolidayBatch } = await import('@/lib/services/email.service');
  for (const bookingIds of Array.from(byCustomer.values())) {
    await sendHolidayBatch({
      bookingIds,
      startDate: params.startDate,
      endDate: params.endDate,
    }).catch(() => {});
  }

  // eslint-disable-next-line no-console
  console.log(
    `[OccurrenceRescue] HOLIDAY ${params.startDate}..${params.endDate}: ${flagged} occurrence(s) flagged across ${byCustomer.size} customer(s) for cleaner ${params.cleanerId}`
  );
  return { ok: true, status: 200, flagged, customers: byCustomer.size };
}

/** Customer: reschedule an UNPAID flagged occurrence with the SAME cleaner —
 *  it stays SCHEDULED and charges at its new T-48h. The new slot must pass the
 *  cleaner's real availability (same predicate as every picker). */
export async function rescheduleUnpaidOccurrence(params: {
  bookingId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
}): Promise<OccurrenceActionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      agreementId: true,
      cleanerId: true,
      status: true,
      paymentStatus: true,
      duration: true,
      date: true,
      startTime: true,
    },
  });
  if (!booking || !booking.agreementId) {
    return { ok: false, status: 404, error: 'Occurrence not found' };
  }
  if (booking.status !== 'CLEANER_CANCELLED' || booking.paymentStatus === 'SUCCEEDED') {
    return {
      ok: false,
      status: 422,
      error: 'This occurrence is not awaiting an unpaid reschedule',
    };
  }
  const when = new Date(`${params.date}T00:00:00`);
  if (Number.isNaN(when.getTime()) || !/^\d{2}:\d{2}$/.test(params.startTime)) {
    return { ok: false, status: 400, error: 'Invalid date or time' };
  }
  if (occurrenceStart(when, params.startTime).getTime() <= Date.now()) {
    return { ok: false, status: 422, error: 'That time is in the past — pick a future slot' };
  }
  const { cleanerAvailableForSlot } = await import('@/lib/availability/slot-eligibility');
  const free = await cleanerAvailableForSlot(booking.cleanerId, {
    date: when,
    startTime: params.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: booking.id,
  });
  if (!free) {
    return {
      ok: false,
      status: 422,
      error: 'Your cleaner is not free at that time — pick another slot, or skip this clean.',
    };
  }
  const claim = await prisma.booking.updateMany({
    where: { id: params.bookingId, status: 'CLEANER_CANCELLED' },
    data: {
      status: 'SCHEDULED',
      date: when,
      startTime: params.startTime,
      rescueDeadline: null,
      cancellationReason: null,
      cancelledByCleanerId: null,
    },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      status: 409,
      error: 'This occurrence was just resolved — check its status',
    };
  }
  await prisma.notification
    .create({
      data: {
        userId: booking.cleanerId,
        type: 'SYSTEM',
        title: 'Regular clean rescheduled',
        body: `The clean you couldn't make has moved to ${params.date} at ${params.startTime}. It confirms as normal closer to the date.`,
        data: { bookingId: params.bookingId },
      },
    })
    .catch(() => {});
  // eslint-disable-next-line no-console
  console.log(
    `[OccurrenceRescue] occurrence ${params.bookingId} rescheduled to ${params.date} ${params.startTime} — back in SCHEDULED (charges at its new T-48h)`
  );
  return { ok: true, status: 200, variant: 'unpaid' };
}

/** Customer skip. James-ruled policy (simpler than the standard ladder):
 *  · SCHEDULED (unpaid): free at any distance — nothing was charged and the
 *    T-48h sweep can never pick a non-SCHEDULED row.
 *  · PAID occurrence: free (full refund) before the 24h cutoff; inside 24h the
 *    charge stands — the skip still cancels the visit, refund £0, honest copy
 *    at the skip point. Rides executeCancellation whole — no new money paths.
 */
export async function skipOccurrence(params: {
  bookingId: string;
  actor: 'client' | 'guest';
}): Promise<OccurrenceActionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      agreementId: true,
      status: true,
      paymentStatus: true,
      date: true,
      startTime: true,
      cleanerId: true,
      stripePaymentIntentId: true,
    },
  });
  if (!booking || !booking.agreementId) {
    return { ok: false, status: 404, error: 'Occurrence not found' };
  }

  const start = occurrenceStart(booking.date, booking.startTime);
  if (start.getTime() <= Date.now()) {
    return { ok: false, status: 422, error: 'This clean has already started' };
  }

  // Unpaid: SCHEDULED, or an unpaid CLEANER_CANCELLED (skipping from the
  // can't-make panel) — plain cancel, nothing charged.
  if (booking.paymentStatus !== 'SUCCEEDED') {
    if (booking.status !== 'SCHEDULED' && booking.status !== 'CLEANER_CANCELLED') {
      return {
        ok: false,
        status: 422,
        error: 'This occurrence cannot be skipped from its current state',
      };
    }
    const claim = await prisma.booking.updateMany({
      where: { id: params.bookingId, status: { in: ['SCHEDULED', 'CLEANER_CANCELLED'] } },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Skipped by customer',
        rescueDeadline: null,
      },
    });
    if (claim.count === 0) {
      return { ok: false, status: 409, error: 'This occurrence was just resolved' };
    }
    if (booking.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch(() => {});
    }
    await prisma.notification
      .create({
        data: {
          userId: booking.cleanerId,
          type: 'SYSTEM',
          title: 'Regular clean skipped',
          body: `The regular clean on ${booking.date.toISOString().split('T')[0]} was skipped by the customer — that slot is free again. The arrangement continues as normal.`,
          data: { bookingId: params.bookingId },
        },
      })
      .catch(() => {});
    // eslint-disable-next-line no-console
    console.log(`[OccurrenceRescue] occurrence ${params.bookingId} skipped (unpaid, free)`);
    return { ok: true, status: 200, variant: 'unpaid', refunded: false };
  }

  // Paid: ride the proven cancellation path whole. Before the cutoff → full
  // refund; inside → £0 (the charge stands — the cleaner's committed time).
  const beforeCutoff = start.getTime() - Date.now() > SKIP_FREE_CUTOFF_MS;
  const { executeCancellation } = await import('@/lib/services/cancellation.service');
  const result = await executeCancellation({
    bookingId: params.bookingId,
    cancelledBy: params.actor,
    reason: beforeCutoff
      ? 'Occurrence skipped by customer (before 24h cutoff — full refund)'
      : 'Occurrence skipped by customer (inside 24h — charge stands)',
    refund: beforeCutoff ? { kind: 'full' } : { kind: 'amount', amount: 0 },
  });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error ?? 'Could not skip' };
  }
  // eslint-disable-next-line no-console
  console.log(
    `[OccurrenceRescue] PAID occurrence ${params.bookingId} skipped — ${beforeCutoff ? 'full refund' : 'charge stands (inside 24h)'}`
  );
  return { ok: true, status: 200, variant: 'paid', refunded: beforeCutoff };
}
