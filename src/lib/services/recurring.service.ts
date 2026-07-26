// R1-A (James-ruled design): recurring agreements — the standing schedule.
//
// THE PRIME LAW: OCCURRENCES ARE BOOKINGS. Every occurrence is a real Booking
// row riding every existing law — notes, detail, .ics, lifecycle, cascade
// eligibility, slot-blocking, Xero. This service only MINTS and VOIDS rows;
// it never invents a parallel path for anything a Booking already does.
//
// Lifecycle: the FIRST occurrence is a normal checkout booking (paid now, the
// proven path). Future occurrences are minted as status=SCHEDULED on a rolling
// window, extended weekly by the scheduler. SCHEDULED rows are excluded from
// offer flows/jobs/badges but BLOCK the cleaner's slot (slot-eligibility) and
// show on their calendar as the regular client. Phase B's charge scheduler
// confirms each occurrence at T-48h.

import { randomBytes } from 'crypto';

import { prisma } from '@/lib/db/prisma';

/** Rolling mint horizon (James-ruled: 8 weeks, extended weekly). */
export const OCCURRENCE_WINDOW_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

function strideDays(frequency: 'WEEKLY' | 'FORTNIGHTLY'): number {
  return frequency === 'WEEKLY' ? 7 : 14;
}

/**
 * Mint missing SCHEDULED occurrences for one agreement up to the horizon.
 * Anchored on the agreement's FIRST booking date (so fortnightly parity is
 * stable forever). Idempotent: existing occurrence dates are skipped, so the
 * weekly extension re-run is safe.
 */
export async function mintOccurrences(
  agreementId: string
): Promise<{ minted: number } | { skipped: string }> {
  const agreement = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    include: {
      bookings: {
        select: { id: true, date: true, paymentStatus: true },
        orderBy: { date: 'asc' },
      },
    },
  });
  if (!agreement) return { skipped: 'agreement not found' };
  if (agreement.status !== 'ACTIVE') return { skipped: `agreement ${agreement.status}` };
  // The anchor is the first PAID occurrence — an agreement whose first checkout
  // was abandoned never mints (the H53/F6a spirit: no payment, nothing real).
  const anchor = agreement.bookings.find((b) => b.paymentStatus === 'SUCCEEDED')?.date;
  if (!anchor) return { skipped: 'no paid anchor booking yet' };

  const horizon = new Date(Date.now() + OCCURRENCE_WINDOW_WEEKS * 7 * DAY_MS);
  const existing = new Set(agreement.bookings.map((b) => b.date.toISOString().slice(0, 10)));
  const stride = strideDays(agreement.frequency);

  let minted = 0;
  for (
    let d = new Date(anchor.getTime() + stride * DAY_MS);
    d <= horizon;
    d = new Date(d.getTime() + stride * DAY_MS)
  ) {
    const key = d.toISOString().slice(0, 10);
    if (existing.has(key)) continue;
    if (d.getTime() < Date.now()) continue; // never mint into the past
    await prisma.booking.create({
      data: {
        agreementId: agreement.id,
        cleanerId: agreement.cleanerId,
        ...(agreement.clientId ? { clientId: agreement.clientId } : {}),
        guestEmail: agreement.clientId ? null : agreement.guestEmail,
        guestName: agreement.clientId ? null : agreement.guestName,
        // Every occurrence gets its own tokened link (guest parity law).
        guestToken: agreement.clientId ? null : randomBytes(24).toString('hex'),
        serviceType: agreement.serviceType,
        date: d,
        startTime: agreement.startTime,
        duration: agreement.duration,
        addressLine1: agreement.addressLine1,
        addressLine2: agreement.addressLine2,
        addressCity: agreement.addressCity,
        addressPostcode: agreement.addressPostcode,
        rooms: agreement.rooms ?? undefined,
        notes: agreement.notes,
        // The per-occurrence money snapshot — the platform's existing splits,
        // captured once from the first booking's quote. No new arithmetic.
        totalPrice: agreement.totalPrice,
        platformFee: agreement.platformFee,
        cleanerEarnings: agreement.cleanerEarnings,
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        cascadePhase: null,
      },
    });
    minted++;
  }
  if (minted > 0) {
    // eslint-disable-next-line no-console
    console.log(`[Recurring] minted ${minted} occurrence(s) for agreement ${agreement.id}`);
  }
  return { minted };
}

/** Scheduler handler: extend every ACTIVE agreement's window. Weekly cadence
 *  is enforced by idempotence, not timing — safe on every cron tick. */
export async function extendAgreementWindows(): Promise<{ processed: number }> {
  const active = await prisma.recurringAgreement.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  let processed = 0;
  for (const a of active) {
    const r = await mintOccurrences(a.id).catch(() => null);
    if (r && 'minted' in r && r.minted > 0) processed++;
  }
  return { processed };
}

/**
 * Either side ends the agreement — no lock-in (James-ruled). Future SCHEDULED
 * occurrences are CANCELLED (not deleted: no data-deleting; reason marks them
 * so they never read as anyone's fault), slots free immediately via the
 * slot-blocking clause, and the other party is told.
 */
export async function endAgreement(
  agreementId: string,
  endedBy: 'CLEANER' | 'CUSTOMER'
): Promise<{ ended: boolean; voided: number }> {
  const agreement = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    include: {
      cleaner: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (!agreement || agreement.status !== 'ACTIVE') return { ended: false, voided: 0 };

  const [, voided] = await prisma.$transaction([
    prisma.recurringAgreement.update({
      where: { id: agreementId },
      data: { status: 'ENDED', endedAt: new Date(), endedBy },
    }),
    prisma.booking.updateMany({
      where: { agreementId, status: 'SCHEDULED' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Recurring agreement ended',
        paymentStatus: 'CANCELED',
      },
    }),
  ]);

  // Tell the other side (both get a bell; the affected party gets the email).
  const { sendAgreementEnded } = await import('@/lib/services/email.service');
  await sendAgreementEnded(agreementId, endedBy).catch(() => {});
  const notifyUserId = endedBy === 'CLEANER' ? agreement.client?.id : agreement.cleaner.id;
  if (notifyUserId) {
    await prisma.notification
      .create({
        data: {
          userId: notifyUserId,
          type: 'SYSTEM',
          title: 'Regular clean ended',
          body:
            endedBy === 'CLEANER'
              ? 'Your cleaner has ended your regular arrangement. Upcoming scheduled cleans are cancelled — nothing has been charged.'
              : 'Your regular client has ended their arrangement. Their upcoming scheduled slots are now free.',
          data: { agreementId },
        },
      })
      .catch(() => {});
  }
  // eslint-disable-next-line no-console
  console.log(
    `[Recurring] agreement ${agreementId} ended by ${endedBy}; ${voided.count} scheduled occurrence(s) voided`
  );
  return { ended: true, voided: voided.count };
}
