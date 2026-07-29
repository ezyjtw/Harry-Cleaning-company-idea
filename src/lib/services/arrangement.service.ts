// F23 (James-ruled): recurring agreements require cleaner acceptance.
//
// The model: the customer PROPOSES (start date, hours, slot) → the agreement
// sits PENDING_CLEANER_ACCEPTANCE — NOT charged, NOT minting, holding nothing
// but a card on the cleaner's surfaces (soft-hold: visible as pending, never
// removed from public availability). The cleaner has a 48h response window.
//   · Accept → the agreement goes ACTIVE, occurrences mint from the start
//     date (inclusive), and the FIRST clean charges NOW via the shared
//     single-attempt path (the F7 saved card that paid the trial clean).
//     Per-occurrence T-48h charging continues as-is for the rest.
//   · Decline / 48h timeout → DECLINED / EXPIRED. NO charge was ever taken —
//     there is nothing to refund, by construction. The customer is told
//     honestly. This retires the cascade-expiry-refund path for recurring
//     first-cleans entirely.

import { timeToMinutes } from '@/lib/availability/timesheet';
import { prisma } from '@/lib/db/prisma';

/** The cleaner's response window (James-ruled: 48 hours). */
export const ARRANGEMENT_RESPONSE_HOURS = 48;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface RespondResult {
  ok: boolean;
  error?: string;
  status?: number;
  chargeOutcome?: 'succeeded' | 'failed' | 'skipped';
}

/**
 * Cleaner accepts the arrangement. Re-validates the slot is STILL open to
 * regulars and still fits (the world may have moved during the window), then
 * atomically claims PENDING → ACTIVE, mints occurrences from the customer's
 * start date, and fires the first charge now.
 */
export async function acceptArrangement(
  agreementId: string,
  cleanerUserId: string
): Promise<RespondResult> {
  const agreement = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      status: true,
      cleanerId: true,
      dayOfWeek: true,
      startTime: true,
      duration: true,
      proposedStartDate: true,
    },
  });
  if (!agreement || agreement.cleanerId !== cleanerUserId) {
    return { ok: false, error: 'Arrangement not found.', status: 404 };
  }
  if (agreement.status !== 'PENDING_CLEANER_ACCEPTANCE') {
    return { ok: false, error: 'This request is no longer open.', status: 409 };
  }

  // Re-validate against the CURRENT slot picture — accepting must never
  // create an arrangement the availability page contradicts. Honest error,
  // agreement stays PENDING (the cleaner can fix the slot and retry, or
  // decline).
  const slot = await prisma.availabilitySlot.findFirst({
    where: {
      cleanerProfile: { userId: cleanerUserId },
      recurringEligible: true,
      dayOfWeek: agreement.dayOfWeek,
      startTime: { lte: agreement.startTime },
      endTime: { gt: agreement.startTime },
    },
    select: {
      startTime: true,
      endTime: true,
      cleanerProfile: { select: { bookingBufferMinutes: true } },
    },
  });
  if (!slot) {
    return {
      ok: false,
      error:
        'This slot is no longer open to regular clients — reopen it on your availability page first, or decline the request.',
      status: 409,
    };
  }
  const bufferMins = slot.cleanerProfile?.bookingBufferMinutes ?? 30;
  const fitMins = timeToMinutes(slot.endTime) - timeToMinutes(agreement.startTime) - bufferMins;
  if (Number(agreement.duration) * 60 > fitMins) {
    return {
      ok: false,
      error:
        'The requested hours no longer fit this regular window — widen the window on your availability page first, or decline the request.',
      status: 409,
    };
  }

  // Atomic claim: PENDING → ACTIVE. A concurrent decline/expiry makes this
  // match zero rows — never a double-transition.
  const claimed = await prisma.recurringAgreement.updateMany({
    where: { id: agreementId, status: 'PENDING_CLEANER_ACCEPTANCE' },
    data: { status: 'ACTIVE', acceptedAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: false, error: 'This request is no longer open.', status: 409 };
  }

  // Mint from the customer's start date (inclusive) — mintOccurrences skips
  // clashes loudly and never mints into the past.
  const { mintOccurrences } = await import('./recurring.service');
  const mintResult = await mintOccurrences(agreementId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[Arrangement] mint after accept failed for ${agreementId}:`, e);
    return null;
  });

  // "The first clean charges now" (James-ruled) — the earliest minted
  // occurrence takes the shared single attempt immediately. Failure follows
  // the standing law: FAILED → pay-now email → T-24h auto-cancel of that one
  // occurrence; the agreement survives.
  let chargeOutcome: 'succeeded' | 'failed' | 'skipped' = 'skipped';
  const first = await prisma.booking.findFirst({
    where: { agreementId, status: 'SCHEDULED' },
    orderBy: { date: 'asc' },
    select: { id: true },
  });
  if (first) {
    const { attemptOccurrenceCharge } = await import('./recurring-charge.service');
    chargeOutcome = await attemptOccurrenceCharge(first.id);
  } else {
    // Start date clashed away or lapsed — ACTIVE with nothing minted yet is a
    // finding, not noise.
    // eslint-disable-next-line no-console
    console.error(
      `[Arrangement] ACCEPTED ${agreementId} but no occurrence existed to charge (mint: ${JSON.stringify(mintResult)}) — INVESTIGATE`
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[Arrangement] ACCEPTED ${agreementId} by cleaner — first occurrence ${first?.id ?? 'none'}, charge ${chargeOutcome}`
  );

  const { sendArrangementAccepted } = await import('./email.service');
  await sendArrangementAccepted(agreementId, chargeOutcome).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[Arrangement] accepted email failed for ${agreementId}:`, e);
  });
  await notifyCustomer(
    agreementId,
    'Your regular clean is on',
    'Your cleaner accepted your regular arrangement — your first clean is booked.'
  );

  return { ok: true, chargeOutcome };
}

/** Cleaner declines. No charge was ever taken; the customer is told honestly. */
export async function declineArrangement(
  agreementId: string,
  cleanerUserId: string
): Promise<RespondResult> {
  const agreement = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    select: { id: true, status: true, cleanerId: true },
  });
  if (!agreement || agreement.cleanerId !== cleanerUserId) {
    return { ok: false, error: 'Arrangement not found.', status: 404 };
  }
  const claimed = await prisma.recurringAgreement.updateMany({
    where: { id: agreementId, status: 'PENDING_CLEANER_ACCEPTANCE' },
    data: { status: 'DECLINED', endedAt: new Date(), endedBy: 'CLEANER' },
  });
  if (claimed.count === 0) {
    return { ok: false, error: 'This request is no longer open.', status: 409 };
  }

  // eslint-disable-next-line no-console
  console.log(`[Arrangement] DECLINED ${agreementId} by cleaner — no charge, customer notified`);

  const { sendArrangementDeclined } = await import('./email.service');
  await sendArrangementDeclined(agreementId, 'DECLINED').catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[Arrangement] declined email failed for ${agreementId}:`, e);
  });
  await notifyCustomer(
    agreementId,
    'Regular clean request declined',
    "Your cleaner couldn't commit to a regular slot right now. You haven't been charged anything."
  );

  return { ok: true };
}

/**
 * Scheduler leg: expire un-answered arrangements past their 48h respondBy.
 * The claim is atomic (status guard) so overlapping ticks never double-fire.
 * Replaces the retired cascade-expiry-refund path: the terminal state of an
 * unanswered proposal is "expired, no charge" — never "charged then refunded".
 */
export async function expirePendingArrangements(): Promise<{ processed: number }> {
  const now = new Date();
  const overdue = await prisma.recurringAgreement.findMany({
    where: { status: 'PENDING_CLEANER_ACCEPTANCE', respondBy: { lte: now } },
    select: { id: true, cleanerId: true },
    take: 20,
  });

  let processed = 0;
  for (const a of overdue) {
    const claimed = await prisma.recurringAgreement.updateMany({
      where: { id: a.id, status: 'PENDING_CLEANER_ACCEPTANCE' },
      data: { status: 'EXPIRED', endedAt: now, endedBy: 'TIMEOUT' },
    });
    if (claimed.count === 0) continue;
    processed++;

    // The watched-set line (James-ruled, verbatim shape).
    // eslint-disable-next-line no-console
    console.log(`[Arrangement] PENDING expired for ${a.id} — no charge, customer notified`);

    const { sendArrangementDeclined } = await import('./email.service');
    await sendArrangementDeclined(a.id, 'EXPIRED').catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[Arrangement] expiry email failed for ${a.id}:`, e);
    });
    await notifyCustomer(
      a.id,
      'Regular clean request expired',
      "Your cleaner didn't respond to your regular clean request in time. You haven't been charged anything."
    );
    await prisma.notification
      .create({
        data: {
          userId: a.cleanerId,
          type: 'SYSTEM',
          title: 'Regular arrangement request expired',
          body: 'A regular arrangement request expired unanswered after 48 hours. The customer has been told — no action needed.',
          data: { agreementId: a.id },
        },
      })
      .catch(() => {});
  }
  return { processed };
}

/** Bell to the customer seat, account holders only (guests get the email). */
async function notifyCustomer(agreementId: string, title: string, body: string): Promise<void> {
  const a = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    select: { clientId: true },
  });
  if (!a?.clientId) return;
  await prisma.notification
    .create({
      data: { userId: a.clientId, type: 'SYSTEM', title, body, data: { agreementId } },
    })
    .catch(() => {});
}

/** Human line for the request surfaces: "every Tuesday at 10:00, 2h". */
export function arrangementLine(a: {
  dayOfWeek: number;
  startTime: string;
  duration: unknown;
}): string {
  return `every ${DAY_NAMES[a.dayOfWeek]} at ${a.startTime}, ${Number(a.duration)}h`;
}
