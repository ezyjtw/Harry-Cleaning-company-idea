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

import { blocksCleanerSlotWhere } from '@/lib/availability/slot-eligibility';
import { blockingOverlap, withCleanerLock } from '@/lib/booking/assign';
import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { validateBookingSlot } from '@/lib/time/booking-time';

/** Rolling mint horizon (James-ruled: 8 weeks, extended weekly). */
export const OCCURRENCE_WINDOW_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

function strideDays(frequency: 'WEEKLY' | 'FORTNIGHTLY'): number {
  return frequency === 'WEEKLY' ? 7 : 14;
}

/**
 * Mint missing SCHEDULED occurrences for one agreement up to the horizon.
 * F23 agreements (proposedStartDate set) anchor on the CUSTOMER-CHOSEN start
 * date, INCLUSIVE — the first clean is occurrence #1, minted here and charged
 * at cleaner-accept; no checkout booking exists any more. Legacy agreements
 * keep the original law: anchored on the first PAID checkout booking,
 * exclusive (that booking already covers the anchor date). Idempotent:
 * existing occurrence dates are skipped, so the weekly extension re-run is
 * safe.
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
  // F23: acceptance IS the commitment — proposedStartDate anchors the series
  // and the start date itself is minted (first = d0, not d0 + stride). For
  // legacy agreements the anchor stays the first PAID occurrence — an
  // agreement whose first checkout was abandoned never mints (the H53/F6a
  // spirit: no payment, nothing real).
  let anchor: Date | null = null;
  let mintAnchorItself = false;
  if (agreement.proposedStartDate) {
    anchor = agreement.proposedStartDate;
    mintAnchorItself = true;
  } else {
    anchor = agreement.bookings.find((b) => b.paymentStatus === 'SUCCEEDED')?.date ?? null;
    if (!anchor) return { skipped: 'no paid anchor booking yet' };
  }

  const horizon = new Date(Date.now() + OCCURRENCE_WINDOW_WEEKS * 7 * DAY_MS);
  const existing = new Set(agreement.bookings.map((b) => b.date.toISOString().slice(0, 10)));
  const stride = strideDays(agreement.frequency);

  let minted = 0;
  for (
    let d = mintAnchorItself
      ? new Date(anchor.getTime())
      : new Date(anchor.getTime() + stride * DAY_MS);
    d <= horizon;
    d = new Date(d.getTime() + stride * DAY_MS)
  ) {
    const key = d.toISOString().slice(0, 10);
    if (existing.has(key)) continue;
    if (d.getTime() < Date.now()) continue; // never mint into the past

    // B3 (James-ruled): a time inside the spring clock change does not exist
    // on that date, so it is never minted (skipped loudly).
    if (!validateBookingSlot(key, agreement.startTime).ok) {
      log.warn('recurring', 'mint_skipped_invalid_time', { agreementId: agreement.id });
      continue;
    }

    // R1 confirmation fix, B3 (RENA-012): the mint checks the cleaner's
    // blocking bookings for an overlap and creates the occurrence inside ONE
    // transaction under the cleaner's advisory lock, so no concurrent
    // assignment can land between the read and the create. A slot honestly
    // taken first is SKIPPED LOUDLY.
    const created = await withCleanerLock(agreement.cleanerId, async (tx) => {
      // The mint has always treated a same-day Flexible booking as a clash
      // (it cannot be placed); that stays.
      const flexibleSameDay = await tx.booking.findFirst({
        where: {
          cleanerId: agreement.cleanerId,
          date: d,
          startTime: 'Flexible',
          AND: [blocksCleanerSlotWhere()],
        },
        select: { id: true },
      });
      const clash =
        flexibleSameDay?.id ??
        (await blockingOverlap(tx, agreement.cleanerId, {
          date: d,
          startTime: agreement.startTime,
          durationHours: Number(agreement.duration),
        }));
      if (clash) {
        // eslint-disable-next-line no-console
        console.error(
          `[Recurring] mint SKIPPED for agreement ${agreement.id} on ${key} — slot conflict with booking ${clash} (booked before the window reached this date)`
        );
        return false;
      }
      await tx.booking.create({
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
          // LB-7: occurrences inherit the agreement's (= trial booking's) answer.
          suppliesProvided: agreement.suppliesProvided,
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
      return true;
    });
    if (!created) continue;
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
      // THE FENCE (James-ruled): void only UNPAID occurrences — a SCHEDULED
      // row the T-48h charge just took paid belongs to the succeeded path,
      // never to a bulk void that would strand its money.
      where: { agreementId, status: 'SCHEDULED', paymentStatus: { notIn: ['SUCCEEDED'] } },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Recurring agreement ended',
        paymentStatus: 'CANCELED',
      },
    }),
  ]);

  // THE FENCE: kill any surviving intents of the occurrences just voided —
  // an alive intent on a dead booking is the exact race the law forbids.
  // Fail-soft per intent (the void stands either way), loud log per failure;
  // the Lane A belt auto-refunds if a stray capture still lands.
  const voidedWithIntent = await prisma.booking.findMany({
    where: {
      agreementId,
      status: 'CANCELLED',
      paymentStatus: 'CANCELED',
      cancellationReason: 'Recurring agreement ended',
      stripePaymentIntentId: { not: null },
    },
    select: { id: true, stripePaymentIntentId: true },
  });
  if (voidedWithIntent.length > 0) {
    const { default: stripe } = await import('@/lib/stripe');
    for (const occ of voidedWithIntent) {
      if (!occ.stripePaymentIntentId) continue;
      try {
        await stripe.paymentIntents.cancel(occ.stripePaymentIntentId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[Recurring] FENCE: could not cancel surviving intent ${occ.stripePaymentIntentId} on voided occurrence ${occ.id} — belt will refund any stray capture`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

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
