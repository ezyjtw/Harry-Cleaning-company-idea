import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { timeToMinutes } from '@/lib/availability/timesheet';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { ARRANGEMENT_RESPONSE_HOURS } from '@/lib/services/arrangement.service';
import { pricingService } from '@/lib/services/pricing.service';

// F23 (James-ruled): the recurring PROPOSAL — replaces the checkout-first
// entry entirely. Creates the agreement as PENDING_CLEANER_ACCEPTANCE:
// NO booking row, NO PaymentIntent, NO charge, NO minting — nothing moves
// until the cleaner accepts. Auth is the trial clean itself: the caller must
// own a COMPLETED clean with this cleaner (session for accounts, tokened link
// for guests — guest parity law).

const DAY_MS = 24 * 60 * 60 * 1000;
/** The chosen start date must leave room for the full 48h response window
 *  plus the T-48h charge lead: minimum 3 days out. 8-week cap is the R1 law. */
const MIN_START_DAYS = 3;
const MAX_START_DAYS = 56;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`arrangement-propose:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests — please try again shortly.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const cleanerId = String(body.cleanerId || '');
  const frequency = String(body.frequency || '').toUpperCase();
  const startDate = String(body.startDate || '');
  const time = String(body.time || '');
  const duration = Number(body.duration);

  if (!cleanerId || cleanerId === 'auto-assign') {
    return NextResponse.json({ error: 'A regular clean needs a chosen cleaner.' }, { status: 400 });
  }
  if (frequency !== 'WEEKLY' && frequency !== 'FORTNIGHTLY') {
    return NextResponse.json(
      { error: 'Recurring frequency must be weekly or fortnightly.' },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: 'Choose a start date and time.' }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 12) {
    return NextResponse.json({ error: 'Choose how many hours you need.' }, { status: 400 });
  }

  // ── The trial-clean wall (structural, James-ruled): the caller IS whoever
  // completed a clean with this cleaner. Accounts prove it via session
  // ownership of the context booking; guests via their tokened link.
  const sessionUser = await getSessionUser();
  const guestToken = typeof body.guestToken === 'string' ? body.guestToken : null;
  const fromBookingId = typeof body.fromBookingId === 'string' ? body.fromBookingId : null;

  // LR-3 (James-ruled): recurring is ACCOUNT-HOLDERS ONLY. The guest tokened
  // path closes with an honest refusal — creating a free account with the
  // booking's email carries the completed clean (and its eligibility) over
  // automatically once the email is verified (A16b-2b claim).
  if (guestToken && !sessionUser) {
    return NextResponse.json(
      {
        error:
          'Regular cleans need a free account. Create one with the email from your booking — your completed clean carries over and you can set up your regular from there.',
      },
      { status: 403 }
    );
  }

  let trial = null;
  if (sessionUser && fromBookingId) {
    trial = await prisma.booking.findFirst({
      where: { id: fromBookingId, clientId: sessionUser.id },
      select: {
        id: true,
        cleanerId: true,
        status: true,
        clientId: true,
        guestEmail: true,
        guestName: true,
        serviceType: true,
        addressLine1: true,
        addressLine2: true,
        addressCity: true,
        addressPostcode: true,
        rooms: true,
        notes: true,
        suppliesProvided: true,
      },
    });
  }
  if (!trial) {
    return NextResponse.json(
      { error: 'Please sign in, or use the link from your completed clean.' },
      { status: 401 }
    );
  }
  if (trial.cleanerId !== cleanerId) {
    return NextResponse.json({ error: 'This link is for a different cleaner.' }, { status: 400 });
  }
  if (trial.status !== 'COMPLETED' && trial.status !== 'REVIEWED') {
    return NextResponse.json(
      { error: 'Book one clean with this cleaner first — then make it regular.' },
      { status: 400 }
    );
  }

  // ── Start date: customer-chosen (F23) — matching weekday enforced below via
  // the slot lookup; runway and the 8-week R1 cap enforced here.
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Choose a valid start date.' }, { status: 400 });
  }
  const todayUtc = new Date(new Date().toISOString().slice(0, 10));
  const daysOut = Math.round((start.getTime() - todayUtc.getTime()) / DAY_MS);
  if (daysOut < MIN_START_DAYS) {
    return NextResponse.json(
      {
        error: `Your first clean needs to be at least ${MIN_START_DAYS} days away — your cleaner has 48 hours to accept the request.`,
      },
      { status: 400 }
    );
  }
  if (daysOut > MAX_START_DAYS) {
    return NextResponse.json(
      { error: 'Bookings can be made up to 8 weeks in advance.' },
      { status: 400 }
    );
  }
  const reqDay = start.getUTCDay();

  // ── The chosen slot must be one the cleaner explicitly opened to regular
  // clients (recurringEligible) and cover the requested weekday + time.
  const slot = await prisma.availabilitySlot.findFirst({
    where: {
      cleanerProfile: { userId: cleanerId },
      recurringEligible: true,
      dayOfWeek: reqDay,
      startTime: { lte: time },
      endTime: { gt: time },
    },
    select: {
      startTime: true,
      endTime: true,
      cleanerProfile: { select: { bookingBufferMinutes: true } },
    },
  });
  if (!slot) {
    return NextResponse.json(
      { error: 'That cleaner has not opened this slot to regular clients.' },
      { status: 400 }
    );
  }

  // F20 item 3: the chosen duration + the cleaner's buffer must FIT the
  // regulars window — honest error naming the day's real capacity, never a
  // clamp. One number chosen once: this same duration prices the quote,
  // blocks the slot on every minted occurrence, and is what charging charges.
  const bufferMins = slot.cleanerProfile?.bookingBufferMinutes ?? 30;
  const fitMins = timeToMinutes(slot.endTime) - timeToMinutes(time) - bufferMins;
  const cleanerRow = await prisma.user.findUnique({
    where: { id: cleanerId },
    select: { name: true },
  });
  if (duration * 60 > fitMins) {
    const maxH = Math.max(0, Math.floor(fitMins / 30) / 2);
    return NextResponse.json(
      {
        error: `${cleanerRow?.name || 'This cleaner'}'s regular slot on ${DAY_NAMES[reqDay]}s fits up to ${maxH} hours — choose fewer hours or a different slot.`,
      },
      { status: 400 }
    );
  }

  // ── Never two live threads for one pair: an open request or a standing
  // arrangement blocks a new proposal (mirrors the never-re-offer law).
  const existing = await prisma.recurringAgreement.findFirst({
    where: {
      cleanerId,
      status: { in: ['PENDING_CLEANER_ACCEPTANCE', 'ACTIVE'] },
      ...(trial.clientId
        ? { clientId: trial.clientId }
        : { guestEmail: { equals: trial.guestEmail ?? '', mode: 'insensitive' } }),
    },
    select: { status: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.status === 'ACTIVE'
            ? 'You already have a regular arrangement with this cleaner.'
            : `You already have a request waiting for ${cleanerRow?.name || 'this cleaner'} — they have 48 hours to respond.`,
      },
      { status: 409 }
    );
  }

  // ── Price: the server's own quote — never trust client-submitted totals.
  // This snapshot is what EVERY occurrence charges (charge-equals-snapshot).
  const serviceSlug = trial.serviceType === 'deep' ? 'deep' : 'regular';
  let quote;
  try {
    quote = await pricingService.calculateQuote({
      cleanerId,
      serviceSlug,
      hours: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pricing error';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const respondBy = new Date(Date.now() + ARRANGEMENT_RESPONSE_HOURS * 60 * 60 * 1000);
  // LR-5: the DB invariant (partial unique index — one open arrangement per
  // pair) backstops the read-guard above. Two simultaneous proposals race the
  // check; whichever creates second hits the index and gets the same honest
  // 409 the read-guard would have given.
  let agreement;
  try {
    agreement = await prisma.recurringAgreement.create({
      data: {
        clientId: trial.clientId,
        guestEmail: trial.clientId ? null : trial.guestEmail,
        guestName: trial.clientId ? null : trial.guestName,
        cleanerId,
        serviceType: serviceSlug,
        frequency,
        dayOfWeek: reqDay,
        startTime: time,
        duration,
        addressLine1: trial.addressLine1 || '',
        addressLine2: trial.addressLine2,
        addressCity: trial.addressCity,
        addressPostcode: trial.addressPostcode || '',
        rooms: trial.rooms ?? undefined,
        notes: trial.notes,
        // LB-7: occurrences inherit the trial clean's supplies answer.
        suppliesProvided: trial.suppliesProvided,
        totalPrice: quote.customerTotal,
        platformFee: quote.customerPlatformFee,
        cleanerEarnings: quote.cleanerPayout,
        status: 'PENDING_CLEANER_ACCEPTANCE',
        proposedStartDate: start,
        respondBy,
        trialBookingId: trial.id,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        {
          error: `You already have a request waiting for ${cleanerRow?.name || 'this cleaner'} — they have 48 hours to respond.`,
        },
        { status: 409 }
      );
    }
    throw err;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[Arrangement] proposal ${agreement.id} created (${frequency}, start ${startDate}) — pending cleaner acceptance until ${respondBy.toISOString()}`
  );

  // Tell the cleaner — email + bell. Failures are loud but never unwind the
  // proposal (the request card on their surfaces is the source of truth).
  const { sendArrangementRequest } = await import('@/lib/services/email.service');
  await sendArrangementRequest(agreement.id).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`[Arrangement] request email failed for ${agreement.id}:`, e);
  });
  await prisma.notification
    .create({
      data: {
        userId: cleanerId,
        type: 'SYSTEM',
        title: 'New regular arrangement request',
        body: `${trial.clientId ? 'A client' : trial.guestName || 'A customer'} wants a regular slot with you — respond within 48 hours from your availability page.`,
        data: { agreementId: agreement.id },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    id: agreement.id,
    status: agreement.status,
    respondBy: respondBy.toISOString(),
  });
}
