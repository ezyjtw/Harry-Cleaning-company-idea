// ─── M3: Cleaner-cancel rescue flow ──────────────────────────────────────────
//
// A cleaner cancelling an accepted/paid job no longer strands the customer
// (previously: status flipped to CANCELLED with NO refund, NO email, NO
// re-offer). Instead the booking enters CLEANER_CANCELLED — a holding state —
// and the customer chooses, within min(48h, booking start):
//
//   (1) FIND ANOTHER → keep the SAME date/time; the booking re-enters matching
//                      as a RENA_FIND broadcast (the A5.5 wider-network phase)
//                      to every eligible cleaner EXCLUDING the canceller.
//                      First to accept takes it at the paid price — no
//                      reconciliation, exactly like cascade-exhaustion
//                      Rena-find. If nobody accepts by the cascade window,
//                      expireRenaFind → CASCADE_EXHAUSTED → auto full refund.
//   (2) REBOOK       → the booking itself re-enters matching with a customer-
//                      chosen cleaner/date: same booking row, same captured
//                      charge — "the money simply moves". Price deltas ride
//                      the EXISTING accept-time reconciliation (cheaper →
//                      partial refund; pricier → top-up approval), so no new
//                      Stripe machinery is introduced at rebook time. The
//                      canceller themselves may be rebooked — but only on a
//                      DIFFERENT date (they cancelled that one).
//   (3) FULL REFUND  → executeCancellation (the proven cancel/refund path)
//                      with a forced 100% directive (cleaner's fault — the
//                      timing policy never applies).
//
//   No choice by the deadline → the scheduler sweep auto-refunds via the same
//   full-refund path (atomic claims make every race coherent: whichever of
//   {customer click, sweep} wins the claim, the loser no-ops). A choice of
//   (1) hands deadline coverage to the cascade's own expiry machinery, whose
//   terminal state is the same auto full refund.
//
// Auto-rescue (system proactively finds a replacement) is explicitly OUT —
// ledgered post-launch.

import { serviceLabelFromSlug } from '@/lib/constants/services';
import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import type { CancellationResult } from './cancellation.service';
import { computeCascadeWindows } from './cascade.service';
import { sendCleanerCancelledRescue, sendRenaFindConcierge } from './email.service';
import { MatchingService } from './matching.service';
import { pricingService, type ServiceSlug } from './pricing.service';

const RESCUE_WINDOW_MS = 48 * 60 * 60 * 1000;

// Statuses a cleaner-cancel can arrive from (must mirror the cleaner PATCH
// route's VALID_TRANSITIONS targets for CANCELLED).
const RESCUABLE_FROM = ['ACCEPTED', 'CONFIRMED', 'EN_ROUTE'] as const;

function bookingStartDateTime(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(':').map(Number);
  const start = new Date(date);
  start.setHours(h || 0, m || 0, 0, 0);
  return start;
}

// ─── Entry: the cleaner cancelled ────────────────────────────────────────────

export async function initiateCleanerCancelRescue(params: {
  bookingId: string;
  cleanerId: string;
  reason?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { bookingId, cleanerId } = params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { client: { select: { id: true, name: true, email: true } } },
  });
  if (!booking) return { ok: false, reason: 'Booking not found' };

  const startAt = bookingStartDateTime(booking.date, booking.startTime);
  const deadline = new Date(Math.min(Date.now() + RESCUE_WINDOW_MS, startAt.getTime()));
  // Cleaner cancelled at/after start: deadline is already due — the customer is
  // still notified and the sweep auto-refunds on its next tick.
  const effectiveDeadline = deadline.getTime() <= Date.now() ? new Date() : deadline;

  // Atomic claim: only a live, cleaner-held booking enters rescue. Cascade
  // fields are torn down; the slot frees immediately because CLEANER_CANCELLED
  // is in no cleaner-facing status allowlist (jobs, dashboard, availability).
  //
  // H19 (law made structural): rescue = a COMMITTED cleaner cancelled;
  // exhaustion = sourcing failed with no commitment. A genuinely committed
  // booking (post-accept, or a direct CONFIRMED) always has cascadePhase null —
  // atomicAccept/renaFindAccept clear it on accept. Guarding cascadePhase: null
  // here makes it IMPOSSIBLE for a still-sourcing booking (any live offer
  // phase) to be routed into the rescue funnel, no matter how the CANCELLED
  // arrives — the claim simply no-ops and the caller gets a clean 409, leaving
  // the cascade (and its own exhaustion → auto-refund) untouched.
  const claim = await prisma.booking.updateMany({
    where: { id: bookingId, status: { in: [...RESCUABLE_FROM] }, cascadePhase: null, cleanerId },
    data: {
      status: 'CLEANER_CANCELLED',
      cancelledByCleanerId: cleanerId, // persistent stamp — survives rebooking
      rescueDeadline: effectiveDeadline,
      cancellationReason: params.reason?.trim() || 'Cancelled by cleaner',
      cascadePhase: null,
      cascadeExpiresAt: null,
      cascadeBackupExpiresAt: null,
    },
  });
  if (claim.count === 0) return { ok: false, reason: 'Booking is not in a cancellable state' };

  await AuditService.log({
    userId: cleanerId,
    action: 'BOOKING_CANCELLED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: { by: 'cleaner', rescue: true, deadline: effectiveDeadline.toISOString() },
  }).catch(() => {});

  // Notify the customer IMMEDIATELY — email (registered or guest-tokened links)
  // + an in-app Notification row (the bell/feed reads these).
  await sendCleanerCancelledRescue({
    bookingId,
    customerName: booking.client?.name || booking.guestName || 'there',
    customerEmail: booking.client?.email || booking.guestEmail || null,
    guestToken: booking.client ? null : booking.guestToken,
    serviceType: booking.serviceType,
    date: booking.date,
    startTime: booking.startTime,
    deadline: effectiveDeadline,
  }).catch(() => {});

  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'BOOKING_CANCELLED',
          title: 'Your cleaner had to cancel',
          body: 'We’re really sorry — choose a full refund or let us help you rebook. Your payment is safe either way.',
          data: { bookingId, rescue: true },
        },
      })
      .catch(() => {});
  }

  return { ok: true };
}

// ─── Choice 1: full refund ───────────────────────────────────────────────────

export async function rescueChooseRefund(params: {
  bookingId: string;
  actor: 'client' | 'guest' | 'sweep';
}): Promise<CancellationResult> {
  const { executeCancellation } = await import('./cancellation.service');
  // The proven path. Full refund forced — the cleaner cancelled, so the
  // customer's timing policy must never reduce it. executeCancellation's atomic
  // claim (status in CANCELLABLE, transfer not blocked) makes the customer-click
  // vs sweep race coherent: one wins, the other gets a clean 409/422.
  return executeCancellation({
    bookingId: params.bookingId,
    cancelledBy: params.actor === 'sweep' ? 'admin' : params.actor,
    reason:
      params.actor === 'sweep'
        ? 'Cleaner cancelled — no customer choice by deadline, auto-refunded'
        : 'Cleaner cancelled — customer chose full refund',
    refund: { kind: 'full' },
  });
}

// ─── Choice: find me another cleaner (same slot) ─────────────────────────────
//
// The customer keeps their date/time and the slot is broadcast to every
// eligible cleaner except the canceller, via the EXISTING RENA_FIND phase:
// renaFindAccept (first-to-accept, at the paid price, qualification =
// backupCleanerIds membership) and expireRenaFind (no taker → CASCADE_EXHAUSTED
// → auto full refund) both already run in production for cascade exhaustion.
// No rating floor here — the exhaustion-path floor protects a customer who
// never consented to substitution; this customer explicitly asked for anyone
// suitable, and dropping them into admin-review limbo on a floor miss would be
// worse than offering wider.

export interface FindAnotherResult {
  ok: boolean;
  status: number;
  error?: string;
  offeredCount?: number;
}

export async function rescueFindAnother(params: { bookingId: string }): Promise<FindAnotherResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      status: true,
      date: true,
      startTime: true,
      duration: true,
      serviceType: true,
      clientId: true,
      cancelledByCleanerId: true,
      cleanerEarnings: true,
      addressPostcode: true,
      address: { select: { postcode: true } },
    },
  });
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };
  if (booking.status !== 'CLEANER_CANCELLED') {
    return { ok: false, status: 422, error: 'This booking is not awaiting a rescue choice' };
  }

  const slotStart = bookingStartDateTime(booking.date, booking.startTime);
  if (slotStart.getTime() <= Date.now()) {
    return {
      ok: false,
      status: 422,
      error: 'That time has already passed — pick a new date instead, or take the full refund.',
    };
  }

  const postcode = booking.addressPostcode || booking.address?.postcode;
  if (!postcode) {
    return {
      ok: false,
      status: 422,
      error: 'We could not search your area — pick a new date instead, or take the full refund.',
    };
  }

  // H9: candidates come from findMatches with its PARTIAL availability gate
  // OFF (recurring-window containment misses date-specific slots and split
  // windows — the exact ①-vs-② divergence James hit). Static eligibility,
  // coverage and service checks still apply; availability truth is THE slot
  // predicate below, identical to ②'s picker.
  const matchResult = await MatchingService.findMatches({
    date: booking.date,
    startTime: booking.startTime,
    duration: Number(booking.duration),
    serviceType: booking.serviceType,
    postcode,
    clientId: booking.clientId ?? undefined,
    skipAvailabilityFilter: true,
  });
  const { filterSlotAvailableCleaners } = await import('@/lib/availability/slot-eligibility');
  const candidates = matchResult.matches
    .filter((m) => m.userId !== booking.cancelledByCleanerId)
    .map((m) => m.userId);
  const slotFree = await filterSlotAvailableCleaners(candidates, {
    date: booking.date,
    startTime: booking.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: booking.id,
  });
  const qualifiedIds = candidates.filter((id) => slotFree.has(id));

  if (qualifiedIds.length === 0) {
    // Honest dead-end: the booking STAYS in CLEANER_CANCELLED with its
    // rescueDeadline intact — the other two choices (and the sweep) still apply.
    return {
      ok: false,
      status: 422,
      error:
        'No other cleaners are free for that exact slot — pick a new date instead, or take the full refund.',
    };
  }

  // Offer window: mirror enterRenaFind — resolve by slot−24h; if the slot is
  // nearer than that, the offer runs right up to the slot itself, after which
  // expireRenaFind auto-refunds.
  const now = new Date();
  const resolveBy = new Date(slotStart.getTime() - 24 * 60 * 60 * 1000);
  const expiresAt = resolveBy.getTime() > now.getTime() ? resolveBy : slotStart;

  // Atomic claim: CLEANER_CANCELLED → AWAITING_CLEANER/RENA_FIND. cleanerId
  // stays the canceller (the enterRenaFind precedent) — every RENA_FIND surface
  // qualifies on backupCleanerIds membership, and the cleaner jobs list's
  // primary predicate excludes the RENA_FIND phase, so the canceller can
  // neither see nor accept it. rescueDeadline is cleared: deadline coverage
  // hands over to cascadeExpiresAt → expireRenaFind → auto full refund.
  const claim = await prisma.booking.updateMany({
    where: { id: booking.id, status: 'CLEANER_CANCELLED' },
    data: {
      status: 'AWAITING_CLEANER',
      cascadePhase: 'RENA_FIND',
      cascadeExpiresAt: expiresAt,
      cascadeBackupExpiresAt: null,
      backupCleanerIds: qualifiedIds,
      declinedCleanerIds: [],
      reserveCleanerIds: [],
      rescueDeadline: null,
      acceptedAt: null,
    },
  });
  if (claim.count === 0) {
    return { ok: false, status: 409, error: 'This booking was just resolved — check its status' };
  }

  await AuditService.log({
    action: 'RENA_FIND_ENTERED',
    entityType: 'Booking',
    entityId: booking.id,
    metadata: {
      rescue: 'find_another',
      candidateCount: qualifiedIds.length,
      excludedCanceller: booking.cancelledByCleanerId,
      expiresAt: expiresAt.toISOString(),
    },
  }).catch(() => {});

  const earnings = `£${Number(booking.cleanerEarnings).toFixed(2)}`;
  for (const cleanerId of qualifiedIds) {
    await prisma.notification
      .create({
        data: {
          userId: cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'Cleaning job available',
          body: `A ${serviceLabelFromSlug(booking.serviceType)} job is available for ${earnings} — first to accept gets it.`,
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
  }

  if (booking.clientId) {
    await prisma.notification
      .create({
        data: {
          userId: booking.clientId,
          type: 'SYSTEM',
          title: 'Finding you another cleaner',
          body: "We've offered your slot to other trusted cleaners — first to accept takes it. If no one can, you'll be refunded in full automatically.",
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});
  }
  // Concierge reassurance email — the same X1 sender the exhaustion-path
  // Rena-find uses (resolves registered vs guest recipient itself).
  await sendRenaFindConcierge(booking.id).catch(() => {});

  return { ok: true, status: 200, offeredCount: qualifiedIds.length };
}

// ─── Choice 2: rebook ────────────────────────────────────────────────────────

export interface RebookResult {
  ok: boolean;
  status: number;
  error?: string;
  newCleanerName?: string;
  priceDelta?: number; // +£ means a top-up will be requested after accept
}

export async function rescueRebook(params: {
  bookingId: string;
  newCleanerId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  isGuest: boolean;
}): Promise<RebookResult> {
  const { bookingId, newCleanerId } = params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };
  if (booking.status !== 'CLEANER_CANCELLED') {
    return { ok: false, status: 422, error: 'This booking is not awaiting a rebooking choice' };
  }
  // The canceller cancelled a DAY, not the relationship: rebooking them is
  // allowed on a different date, refused on the one they just cancelled.
  // (booking.date is still the original date here — it only changes on claim.)
  if (
    newCleanerId === booking.cancelledByCleanerId &&
    params.date === booking.date.toISOString().split('T')[0]
  ) {
    return {
      ok: false,
      status: 422,
      error:
        'That cleaner cancelled this date — pick a different day with them, or choose another cleaner.',
    };
  }

  const newCleaner = await prisma.user.findFirst({
    where: {
      id: newCleanerId,
      role: 'CLEANER',
      cleanerProfile: { is: { verified: true } },
    },
    select: { id: true, name: true },
  });
  if (!newCleaner) return { ok: false, status: 404, error: 'Cleaner not found or not active' };

  const when = new Date(`${params.date}T00:00:00`);
  if (Number.isNaN(when.getTime()) || !/^\d{2}:\d{2}$/.test(params.startTime)) {
    return { ok: false, status: 400, error: 'Invalid date or time' };
  }
  if (bookingStartDateTime(when, params.startTime).getTime() <= Date.now()) {
    return { ok: false, status: 422, error: 'That time is in the past — pick a future slot' };
  }

  // H7: the picker (search) only shows genuinely free cleaners, but the server
  // must enforce the same predicate — a crafted POST could otherwise rebook a
  // cleaner whose timesheet doesn't cover the slot.
  const { cleanerAvailableForSlot } = await import('@/lib/availability/slot-eligibility');
  const slotOk = await cleanerAvailableForSlot(newCleanerId, {
    date: when,
    startTime: params.startTime,
    durationHours: Number(booking.duration),
    excludeBookingId: booking.id,
  });
  if (!slotOk) {
    return {
      ok: false,
      status: 422,
      error: 'That cleaner is not genuinely free at that time — pick another slot or cleaner.',
    };
  }

  // Quote the new cleaner so the customer sees the delta honestly. Guests
  // cannot ride the top-up machinery (no saved customer), so a pricier
  // rebooking is refused for guests — the picker greys those cleaners out.
  let priceDelta = 0;
  try {
    const { normalizeToPricingSlug, propertySizeEnumToSlug } =
      await import('@/lib/constants/services');
    const quote = await pricingService.calculateQuote({
      cleanerId: newCleanerId,
      serviceSlug: normalizeToPricingSlug(booking.serviceType) as ServiceSlug,
      hours: Number(booking.duration),
      propertySize: booking.propertySize
        ? propertySizeEnumToSlug(
            booking.propertySize as Parameters<typeof propertySizeEnumToSlug>[0]
          )
        : undefined,
      addons: booking.extras,
    });
    priceDelta = Math.round((quote.customerTotal - Number(booking.totalPrice)) * 100) / 100;
  } catch {
    return { ok: false, status: 422, error: 'Could not price this cleaner for your booking' };
  }
  // F5: guests may now pick pricier cleaners — the approval email carries their
  // token and the difference is collected on the tokened approval page after
  // the cleaner accepts. (The old refusal predates guest top-up support.)

  // Re-enter matching: SAME booking row, SAME captured charge — no Stripe call
  // here at all ("the money simply moves"). The chosen cleaner gets a normal
  // PRIMARY_OFFER; their accept runs acceptWithReconciliation, which settles
  // any delta via the existing partial-refund / top-up machinery.
  const now = new Date();
  const cascade = computeCascadeWindows(when, params.startTime, now);
  const claim = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'CLEANER_CANCELLED' },
    data: {
      status: 'AWAITING_CLEANER',
      cleanerId: newCleanerId,
      date: when,
      startTime: params.startTime,
      rescueDeadline: null,
      acceptedAt: null,
      ...(cascade
        ? {
            cascadePhase: 'PRIMARY_OFFER',
            cascadeExpiresAt: cascade.cascadeExpiresAt,
            cascadeBackupExpiresAt: cascade.cascadeBackupExpiresAt,
          }
        : { cascadePhase: 'PRIMARY_OFFER' }),
    },
  });
  if (claim.count === 0) {
    // Lost the race (sweep refunded, or a concurrent choice landed first).
    return { ok: false, status: 409, error: 'This booking was just resolved — check its status' };
  }

  await AuditService.log({
    action: 'BOOKING_UPDATED',
    entityType: 'Booking',
    entityId: bookingId,
    metadata: {
      rescue: 'rebooked',
      newCleanerId,
      date: params.date,
      startTime: params.startTime,
      priceDelta,
    },
  }).catch(() => {});

  // Offer notification to the new cleaner (same shape the payment-success path
  // sends for a fresh booking).
  await prisma.notification
    .create({
      data: {
        userId: newCleanerId,
        type: 'BOOKING_REQUEST',
        title: 'New booking request',
        body: `New ${serviceLabelFromSlug(booking.serviceType)} booking on ${params.date} — please accept or decline.`,
        data: { bookingId },
      },
    })
    .catch(() => {});

  return {
    ok: true,
    status: 200,
    newCleanerName: newCleaner.name || 'your new cleaner',
    priceDelta,
  };
}

// ─── Timeout sweep (scheduler) ───────────────────────────────────────────────

export async function sweepRescueTimeouts(): Promise<{ scanned: number; refunded: number }> {
  const due = await prisma.booking.findMany({
    where: { status: 'CLEANER_CANCELLED', rescueDeadline: { lte: new Date() } },
    select: { id: true },
    take: 25,
  });

  let refunded = 0;
  for (const b of due) {
    try {
      // eslint-disable-next-line no-console
      console.warn(
        `[RESCUE-SWEEP] booking ${b.id}: no customer choice by deadline — auto-refunding in full`
      );
      const result = await rescueChooseRefund({ bookingId: b.id, actor: 'sweep' });
      if (result.ok) refunded++;
      // A late customer click that won the race leaves this a clean no-op
      // (executeCancellation's claim fails → ok:false) — coherent either way.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[RESCUE-SWEEP] failed for booking ${b.id}:`, err);
    }
  }
  return { scanned: due.length, refunded };
}
