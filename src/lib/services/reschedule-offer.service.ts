// R10 Lane 2 (James-ruled): the one-off reschedule OFFER. A cleaner may
// propose a time change for a SINGLE occurrence of a repeat booking; the
// customer chooses (the R1-C law — no unilateral edits, the agreement is
// untouched in every branch). Price untouched. An accepted change moves only
// that occurrence's date/startTime — the recurring charge (T-48h) and reap
// (T-24h) clocks re-anchor automatically because both sweeps window on the
// occurrence's actual date+startTime (F22).
//
// Expiry (James-ruled): the earlier of offer+48h or the ORIGINAL slot's
// T-24h, so the standing machinery never runs while an offer is ambiguous.
// Accept-time guards (James-ruled): the proposed instant must still be at
// least 24h away, and the cleaner must still be slot-free at the new time.
//
// "Slot-free" here is deliberately NOT the H7 search predicate. H7 answers
// "would search offer this cleaner?" and includes her weekly template — but
// the cleaner PROPOSED this time herself, often precisely because her normal
// week does not fit. The honest guard is a CLASH check: no commitment booking
// (± her buffer) and no time-off override at the proposed time. Checked at
// offer time (so an unacceptable offer is refused up front) and again at
// accept time (the race guard).

import { blocksCleanerSlotWhere } from '@/lib/availability/slot-eligibility';
import { timeToMinutes } from '@/lib/availability/timesheet';
import { prisma } from '@/lib/db/prisma';

const HOUR_MS = 60 * 60 * 1000;
const OFFER_TTL_MS = 48 * HOUR_MS;
const MIN_LEAD_MS = 24 * HOUR_MS;

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function slotInstant(date: Date, time: string): number {
  const [h, m] = time.split(':').map(Number);
  return date.getTime() + ((h || 0) * 60 + (m || 0)) * 60 * 1000;
}

function fmtWhen(date: Date, time: string): string {
  return `${date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })} at ${time}`;
}

/**
 * The clash check behind both slot-free guards: does the cleaner have a
 * commitment booking (± her booking buffer) or a time-off override across
 * the proposed slot? Her weekly TEMPLATE is deliberately not consulted —
 * she proposed this time herself (see header note).
 */
async function cleanerClashAt(args: {
  cleanerUserId: string;
  date: Date; // UTC midnight of the proposed day
  startTime: string; // "HH:MM"
  durationHours: number;
  excludeBookingId: string;
}): Promise<string | null> {
  const dayStart = new Date(args.date);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR_MS);
  const [profile, bookings] = await Promise.all([
    prisma.cleanerProfile.findUnique({
      where: { userId: args.cleanerUserId },
      select: {
        bookingBufferMinutes: true,
        availabilityOverrides: {
          where: { date: { gte: dayStart, lt: dayEnd } },
          select: { isBlocked: true, startTime: true, endTime: true },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        cleanerId: args.cleanerUserId,
        id: { not: args.excludeBookingId },
        date: { gte: dayStart, lt: dayEnd },
        AND: [blocksCleanerSlotWhere()],
      },
      select: { startTime: true, duration: true },
    }),
  ]);
  const buffer = profile?.bookingBufferMinutes ?? 30;
  const start = timeToMinutes(args.startTime);
  const end = start + args.durationHours * 60;
  for (const o of profile?.availabilityOverrides ?? []) {
    if (!o.isBlocked) continue;
    if (!o.startTime || !o.endTime) return 'time off booked that day';
    if (timeToMinutes(o.startTime) < end && timeToMinutes(o.endTime) > start) {
      return 'time off booked over that time';
    }
  }
  for (const b of bookings) {
    const bStart = timeToMinutes(b.startTime);
    if (Number.isNaN(bStart)) continue; // Flexible-time rows carry no clock
    const bEnd = bStart + Number(b.duration) * 60;
    if (bStart - buffer < end && bEnd + buffer > start) {
      return 'another booking at that time';
    }
  }
  return null;
}

export type OfferResult =
  | { ok: true; offerId: string; expiresAt: Date }
  | { ok: false; status: number; error: string };

export async function offerReschedule(params: {
  bookingId: string;
  cleanerId: string;
  proposedDate: string; // "YYYY-MM-DD"
  proposedTime: string; // "HH:MM"
}): Promise<OfferResult> {
  const { bookingId, cleanerId } = params;
  if (!DATE_RE.test(params.proposedDate) || !TIME_RE.test(params.proposedTime)) {
    return { ok: false, status: 400, error: 'Pick a valid date and time.' };
  }
  const proposedDate = new Date(`${params.proposedDate}T00:00:00.000Z`);
  const proposedAt = slotInstant(proposedDate, params.proposedTime);
  if (proposedAt < Date.now() + MIN_LEAD_MS) {
    return {
      ok: false,
      status: 400,
      error: 'The new time must be at least 24 hours away so the booking machinery can follow it.',
    };
  }

  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cleanerId: true,
      clientId: true,
      agreementId: true,
      status: true,
      paymentStatus: true,
      date: true,
      startTime: true,
      duration: true,
    },
  });
  if (!b) return { ok: false, status: 404, error: 'Booking not found.' };
  if (b.cleanerId !== cleanerId) {
    return { ok: false, status: 403, error: 'This is not your job.' };
  }
  if (!b.agreementId) {
    return {
      ok: false,
      status: 400,
      error:
        'Time change offers are for regular cleans only. For one-off bookings, message the customer.',
    };
  }
  if (!['SCHEDULED', 'ACCEPTED', 'CONFIRMED'].includes(b.status)) {
    return { ok: false, status: 400, error: 'This visit is not in a state that can move.' };
  }

  const originalStart = slotInstant(b.date, b.startTime);
  if (originalStart <= Date.now()) {
    return { ok: false, status: 400, error: 'This visit has already started or passed.' };
  }
  // James-ruled expiry bound; born-dead refusal mirrors the 5B law.
  const expiresAt = new Date(Math.min(Date.now() + OFFER_TTL_MS, originalStart - 24 * HOUR_MS));
  if (expiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return {
      ok: false,
      status: 400,
      error:
        'Too close to the visit. The offer window would already be shut. Message the customer directly instead.',
    };
  }

  const open = await prisma.rescheduleOffer.findFirst({
    where: { bookingId, status: 'offered' },
    select: { id: true },
  });
  if (open) {
    return { ok: false, status: 409, error: 'There is already an open offer on this visit.' };
  }

  // Offer-time slot-free guard: refuse up front rather than let the customer
  // accept into a clash later.
  const clash = await cleanerClashAt({
    cleanerUserId: cleanerId,
    date: proposedDate,
    startTime: params.proposedTime,
    durationHours: Number(b.duration),
    excludeBookingId: bookingId,
  });
  if (clash) {
    return {
      ok: false,
      status: 409,
      error: `You are not free at that time (${clash}). Pick a different time.`,
    };
  }

  const offer = await prisma.rescheduleOffer.create({
    data: {
      bookingId,
      cleanerId,
      proposedDate,
      proposedTime: params.proposedTime,
      originalDate: b.date,
      originalTime: b.startTime,
      expiresAt,
    },
  });

  // Customer comms: bell + email, both times stated plainly. Best-effort.
  const fromWhen = fmtWhen(b.date, b.startTime);
  const toWhen = fmtWhen(proposedDate, params.proposedTime);
  if (b.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: b.clientId,
          type: 'SYSTEM',
          title: 'Your cleaner suggests a new time',
          body: `For one visit only: from ${fromWhen} to ${toWhen}. The price stays the same. Accept or decline on the booking page. If you do nothing, the visit stays at its original time.`,
          data: { bookingId, url: `/booking/${bookingId}` },
        },
      })
      .catch(() => {});
  }
  try {
    const { sendRescheduleOffer } = await import('./email.service');
    await sendRescheduleOffer(offer.id);
  } catch {
    // email is best-effort; the bell and the booking page carry the offer
  }

  return { ok: true, offerId: offer.id, expiresAt };
}

export type ResolveResult =
  | { ok: true; action: 'accepted' | 'declined' }
  | { ok: false; status: number; error: string };

export async function resolveRescheduleOffer(params: {
  offerId: string;
  action: 'accept' | 'decline';
}): Promise<ResolveResult> {
  const offer = await prisma.rescheduleOffer.findUnique({
    where: { id: params.offerId },
    select: {
      id: true,
      bookingId: true,
      cleanerId: true,
      status: true,
      expiresAt: true,
      proposedDate: true,
      proposedTime: true,
      originalDate: true,
      originalTime: true,
      booking: { select: { duration: true, clientId: true } },
    },
  });
  if (!offer) return { ok: false, status: 404, error: 'Offer not found.' };
  if (offer.status !== 'offered' || offer.expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 410, error: 'This offer is no longer open.' };
  }

  if (params.action === 'decline') {
    const claim = await prisma.rescheduleOffer.updateMany({
      where: { id: offer.id, status: 'offered' },
      data: { status: 'declined', resolvedAt: new Date() },
    });
    if (claim.count === 0)
      return { ok: false, status: 410, error: 'This offer is no longer open.' };
    await prisma.notification
      .create({
        data: {
          userId: offer.cleanerId,
          type: 'SYSTEM',
          title: 'Time change declined',
          body: `The customer kept the original time, ${fmtWhen(offer.originalDate, offer.originalTime)}. The visit is unchanged.`,
          data: { bookingId: offer.bookingId },
        },
      })
      .catch(() => {});
    return { ok: true, action: 'declined' };
  }

  // ACCEPT — the two James-ruled accept-time guards first.
  const proposedAt = slotInstant(offer.proposedDate, offer.proposedTime);
  if (proposedAt < Date.now() + MIN_LEAD_MS) {
    return {
      ok: false,
      status: 410,
      error: 'The proposed time is now less than 24 hours away, so it can no longer be accepted.',
    };
  }
  const clash = await cleanerClashAt({
    cleanerUserId: offer.cleanerId,
    date: offer.proposedDate,
    startTime: offer.proposedTime,
    durationHours: Number(offer.booking.duration),
    excludeBookingId: offer.bookingId,
  });
  if (clash) {
    return {
      ok: false,
      status: 409,
      error: 'Your cleaner is no longer free at the proposed time. The visit stays as it was.',
    };
  }

  // Atomic, pinned to the ORIGINAL date/time (the same TOCTOU law as the
  // admin claims): any concurrent change to the occurrence makes count 0.
  const moved = await prisma.booking.updateMany({
    where: {
      id: offer.bookingId,
      status: { in: ['SCHEDULED', 'ACCEPTED', 'CONFIRMED'] },
      date: offer.originalDate,
      startTime: offer.originalTime,
    },
    data: { date: offer.proposedDate, startTime: offer.proposedTime },
  });
  if (moved.count === 0) {
    return {
      ok: false,
      status: 409,
      error: 'This visit changed while the offer was open, so it could not be moved.',
    };
  }
  const claim = await prisma.rescheduleOffer.updateMany({
    where: { id: offer.id, status: 'offered' },
    data: { status: 'accepted', resolvedAt: new Date() },
  });
  if (claim.count === 0) {
    // The booking moved but the offer was resolved concurrently — restore is
    // NOT attempted (the move was customer-authorized either way); log loudly.
    // eslint-disable-next-line no-console
    console.error(`[Reschedule] offer ${offer.id} raced its own resolution after the move`);
  }

  await prisma.notification
    .create({
      data: {
        userId: offer.cleanerId,
        type: 'SYSTEM',
        title: 'Time change accepted',
        body: `This visit has moved to ${fmtWhen(offer.proposedDate, offer.proposedTime)}. A fresh calendar invite is in your email. Just this visit changes.`,
        data: { bookingId: offer.bookingId },
      },
    })
    .catch(() => {});
  try {
    const { sendRescheduleAccepted } = await import('./email.service');
    await sendRescheduleAccepted(offer.id);
  } catch {
    // best-effort — the bell already carries the outcome
  }

  return { ok: true, action: 'accepted' };
}

/** Scheduler sweep: close unanswered offers at their bound. Cleaner bell. */
export async function expireRescheduleOffers(): Promise<{ processed: number }> {
  const stale = await prisma.rescheduleOffer.findMany({
    where: { status: 'offered', expiresAt: { lte: new Date() } },
    select: { id: true, bookingId: true, cleanerId: true, originalDate: true, originalTime: true },
    take: 50,
  });
  let processed = 0;
  for (const o of stale) {
    const claim = await prisma.rescheduleOffer.updateMany({
      where: { id: o.id, status: 'offered' },
      data: { status: 'expired', resolvedAt: new Date() },
    });
    if (claim.count === 0) continue;
    processed++;
    await prisma.notification
      .create({
        data: {
          userId: o.cleanerId,
          type: 'SYSTEM',
          title: 'Time change offer expired',
          body: `The customer did not answer in time, so the visit stays at ${fmtWhen(o.originalDate, o.originalTime)}.`,
          data: { bookingId: o.bookingId },
        },
      })
      .catch(() => {});
  }
  return { processed };
}
