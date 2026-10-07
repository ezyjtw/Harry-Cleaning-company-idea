// B3.2 (RENA-028, RENA-027, RENA-032; D-f, James-ruled): the cleaner's
// lifecycle moves as compare-and-swap writes inside the D-f windows.
//
// transitionBooking validates the move against the transition map, checks the
// window (skipped for an ADMIN actor: the audited override route), then writes
// with updateMany WHERE { id, cleanerId, status: from }. Zero rows is
// STATE_CHANGED: someone else (a customer cancel, a double tap) moved the row
// first, and the caller's side effects never run.
//
// Invariant I2: COMPLETED is reached from EN_ROUTE or IN_PROGRESS only, by
// CAS, inside the window; releaseDueAt and completedAt are written in that
// same statement, so at most once per booking.
// Invariant I3: customer cancel, admin cancel and these transitions are all
// CAS on status, so cancellation and completion are mutually exclusive.

import type { Booking, BookingStatus, Prisma } from '@prisma/client';

import prisma from '@/lib/db/prisma';
import { transitionWindow, type WindowTarget } from '@/lib/time/booking-time';

// 4.6 (James-ruled): Accept → EN_ROUTE ("On my way") → COMPLETED ("Mark
// complete"); EN_ROUTE → IN_PROGRESS → COMPLETED stays legal (and is the only
// road for a Flexible-time job, B3 ruling).
export const CLEANER_TRANSITIONS: Record<string, BookingStatus[]> = {
  PENDING: ['CANCELLED'],
  AWAITING_CLEANER: ['ACCEPTED', 'CANCELLED'],
  CONFIRMED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REVIEWED: [],
  CANCELLED: [],
  DISPUTED: [],
};

export type TransitionTarget = 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type TransitionResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: 'INVALID_TRANSITION'; allowed: BookingStatus[] }
  | { ok: false; code: 'NEEDS_START' }
  | { ok: false; code: 'TOO_EARLY'; opensAt: Date }
  | { ok: false; code: 'STATE_CHANGED' };

/** X3 (James-ruled): first booking with this customer 24h, repeat 6h. */
async function holdHoursFor(booking: Pick<Booking, 'id' | 'clientId' | 'cleanerId'>) {
  const priorCompleted = await prisma.booking.count({
    where: {
      clientId: booking.clientId,
      cleanerId: booking.cleanerId,
      status: 'COMPLETED',
      id: { not: booking.id },
    },
  });
  return priorCompleted > 0 ? 6 : 24;
}

export async function transitionBooking(params: {
  booking: Booking;
  cleanerId: string;
  to: TransitionTarget;
  now?: Date;
  actor: { kind: 'CLEANER' | 'ADMIN'; id?: string };
  notes?: string;
  cancellationReason?: string;
}): Promise<TransitionResult> {
  const { booking, cleanerId, to } = params;
  const now = params.now ?? new Date();
  const from = booking.status;

  const allowed = CLEANER_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) return { ok: false, code: 'INVALID_TRANSITION', allowed };

  if (params.actor.kind !== 'ADMIN') {
    const w = transitionWindow(to as WindowTarget, booking, now);
    if (!w.allowed) {
      if (w.code === 'NEEDS_START') return { ok: false, code: 'NEEDS_START' };
      return { ok: false, code: 'TOO_EARLY', opensAt: w.opensAt };
    }
  }

  // The write per target is exactly the pre-B3 one.
  const data: Prisma.BookingUncheckedUpdateManyInput = { status: to };
  if (params.notes) data.cleanerNotes = params.notes;
  if (to === 'EN_ROUTE') data.arrivalConfirmed = true;
  if (to === 'IN_PROGRESS') data.checkedInAt = now;
  if (to === 'COMPLETED') {
    data.completedAt = now;
    data.releaseDueAt = new Date(now.getTime() + (await holdHoursFor(booking)) * 3600_000);
  }
  if (to === 'CANCELLED') {
    data.cancelledAt = now;
    data.cancellationReason = params.cancellationReason || 'Cancelled by cleaner';
    // #6: null cascade fields on genuine cancellation.
    data.cascadePhase = null;
    data.cascadeExpiresAt = null;
    data.cascadeBackupExpiresAt = null;
  }

  const claim = await prisma.booking.updateMany({
    where: { id: booking.id, cleanerId, status: from },
    data,
  });
  if (claim.count === 0) return { ok: false, code: 'STATE_CHANGED' };

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  return { ok: true, booking: updated };
}
