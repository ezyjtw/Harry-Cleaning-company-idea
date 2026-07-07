// ─── M3: Cleaner-cancel rescue flow ──────────────────────────────────────────
//
// A cleaner cancelling an accepted/paid job no longer strands the customer
// (previously: status flipped to CANCELLED with NO refund, NO email, NO
// re-offer). Instead the booking enters CLEANER_CANCELLED — a holding state —
// and the customer chooses, within min(48h, booking start):
//
//   (1) FULL REFUND  → executeCancellation (the proven cancel/refund path)
//                      with a forced 100% directive (cleaner's fault — the
//                      timing policy never applies).
//   (2) REBOOK       → the booking itself re-enters matching with a customer-
//                      chosen cleaner/date: same booking row, same captured
//                      charge — "the money simply moves". Price deltas ride
//                      the EXISTING accept-time reconciliation (cheaper →
//                      partial refund; pricier → top-up approval), so no new
//                      Stripe machinery is introduced at rebook time.
//
//   No choice by the deadline → the scheduler sweep auto-refunds via the same
//   full-refund path (atomic claims make every race coherent: whichever of
//   {customer click, sweep} wins the claim, the loser no-ops).
//
// Auto-rescue (system proactively finds a replacement) is explicitly OUT —
// ledgered post-launch.

import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import type { CancellationResult } from './cancellation.service';
import { computeCascadeWindows } from './cascade.service';
import { sendCleanerCancelledRescue } from './email.service';
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
  const claim = await prisma.booking.updateMany({
    where: { id: bookingId, status: { in: [...RESCUABLE_FROM] }, cleanerId },
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
  if (newCleanerId === booking.cancelledByCleanerId) {
    return { ok: false, status: 422, error: 'That cleaner cancelled this booking' };
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

  // Quote the new cleaner so the customer sees the delta honestly. Guests
  // cannot ride the top-up machinery (no saved customer), so a pricier
  // rebooking is refused for guests — the picker greys those cleaners out.
  let priceDelta = 0;
  try {
    const { normalizeToPricingSlug, propertySizeEnumToSlug } = await import(
      '@/lib/constants/services'
    );
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
  if (params.isGuest && priceDelta > 0.01) {
    return {
      ok: false,
      status: 422,
      error: 'This cleaner costs more than you paid — guest rebookings must be the same price or less. Choose another cleaner or take the full refund.',
    };
  }

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
        body: `New ${booking.serviceType} booking on ${params.date} — please accept or decline.`,
        data: { bookingId },
      },
    })
    .catch(() => {});

  return { ok: true, status: 200, newCleanerName: newCleaner.name || 'your new cleaner', priceDelta };
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
