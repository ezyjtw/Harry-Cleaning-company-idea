import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// F21 (James-requested): reconciliation self-check — admin-only, READ-ONLY by
// construction. No writes, no Stripe calls: the actual processing fee comes
// from the stored XERO_PUSH job payload (captured from the charge's balance
// transaction at payment time); a booking whose fee was never captured is
// marked UNVERIFIED, never fetched live.
//
//   GET /api/admin/reconciliation?since=2026-07-20   (also accepts 20/07[/2026])
//   default window: last 7 days · ?format=json for machine output,
//   default is a human-readable text block.

export const dynamic = 'force-dynamic';

const pence = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const gbp = (p: number) => `£${(p / 100).toFixed(2)}`;

function parseSince(raw: string | null): Date {
  if (raw) {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
    // DD/MM or DD/MM/YYYY
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const now = new Date();
      const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
      return new Date(year, Number(m[2]) - 1, Number(m[1]));
    }
  }
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

type EventStatus =
  | { state: 'COMPLETED'; xeroId: string }
  | { state: 'FAILED'; reason: string }
  | { state: 'PENDING' }
  | { state: 'MISSING (enqueued, never drained)' }
  | { state: 'MISSING (never enqueued)' }
  | { state: 'NOT DUE' };

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const since = parseSince(request.nextUrl.searchParams.get('since'));
  const asJson = request.nextUrl.searchParams.get('format') === 'json';

  // Window definition (stated in the report): bookings CREATED since the date
  // whose payment succeeded (incl. partial/full refunds afterwards).
  const bookings = await prisma.booking.findMany({
    where: {
      createdAt: { gte: since },
      paymentStatus: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      date: true,
      serviceType: true,
      totalPrice: true,
      platformFee: true,
      cleanerEarnings: true,
      transferStatus: true,
      paymentStatus: true,
      agreementId: true,
    },
  });
  const ids = bookings.map((b) => b.id);

  const [pushLogs, xeroJobs, refunds, chargeFailures] = await Promise.all([
    prisma.xeroPushLog.findMany({
      where: { bookingId: { in: ids } },
      select: {
        bookingId: true,
        event: true,
        externalRef: true,
        status: true,
        xeroId: true,
        lastError: true,
      },
    }),
    prisma.backgroundJob.findMany({
      where: { type: 'XERO_PUSH', createdAt: { gte: since } },
      select: { payload: true, status: true },
    }),
    prisma.refundRecord.findMany({
      where: { bookingId: { in: ids }, status: { in: ['SUCCEEDED', 'COMPLETED'] } },
      select: { bookingId: true, stripeRefundId: true, amount: true },
    }),
    // RecurringCharge failures ARE db-visible: an occurrence whose single
    // T-48h attempt failed sits at paymentStatus FAILED.
    prisma.booking.count({
      where: {
        agreementId: { not: null },
        paymentStatus: 'FAILED',
        updatedAt: { gte: since },
      },
    }),
  ]);

  const failedPushesInWindow = await prisma.xeroPushLog.count({
    where: { status: 'FAILED', updatedAt: { gte: since } },
  });

  // Stored balance-transaction fees, keyed by booking (from the push payload).
  const feeByBooking = new Map<string, number>();
  const jobByKey = new Map<string, string>(); // `${bookingId}|${event}` -> job status
  for (const j of xeroJobs) {
    const p = j.payload as { bookingId?: string; event?: string; stripeFeeAmount?: number } | null;
    if (!p?.bookingId || !p.event) continue;
    jobByKey.set(`${p.bookingId}|${p.event}`, j.status);
    if (p.event === 'PAYMENT_RECEIVED' && typeof p.stripeFeeAmount === 'number') {
      feeByBooking.set(p.bookingId, pence(p.stripeFeeAmount));
    }
  }
  const logByKey = new Map<string, (typeof pushLogs)[number]>();
  for (const l of pushLogs) logByKey.set(`${l.bookingId}|${l.event}|${l.externalRef}`, l);
  const refundsByBooking = new Map<string, { stripeRefundId: string | null; amount: number }[]>();
  for (const r of refunds) {
    const list = refundsByBooking.get(r.bookingId) ?? [];
    list.push({ stripeRefundId: r.stripeRefundId, amount: pence(r.amount) });
    refundsByBooking.set(r.bookingId, list);
  }

  const eventStatus = (bookingId: string, event: string, externalRef = ''): EventStatus => {
    const log = logByKey.get(`${bookingId}|${event}|${externalRef}`);
    if (log) {
      if (log.status === 'COMPLETED') return { state: 'COMPLETED', xeroId: log.xeroId ?? '' };
      if (log.status === 'FAILED') return { state: 'FAILED', reason: log.lastError ?? 'unknown' };
      return { state: 'PENDING' };
    }
    if (jobByKey.has(`${bookingId}|${event}`))
      return { state: 'MISSING (enqueued, never drained)' };
    return { state: 'MISSING (never enqueued)' };
  };

  let expectedNetPence = 0;
  let pushedNetPence = 0;
  let mismatches = 0;
  let unverified = 0;

  const rows = bookings.map((b) => {
    const gross = pence(b.totalPrice);
    const cleanerNet = pence(b.cleanerEarnings);
    const platformFee = pence(b.platformFee);
    // Split derivation (stated): the 6% service fee sits on top of the base
    // (gross = base × 1.06); commission is the rest of the platform take.
    const serviceFee = gross - Math.round(gross / 1.06);
    const commission = platformFee - serviceFee;
    const splitsOk = Math.abs(gross - platformFee - cleanerNet) <= 1;

    const stripeFeePence = feeByBooking.get(b.id) ?? null;
    if (stripeFeePence === null) unverified++;

    const bookingRefunds = refundsByBooking.get(b.id) ?? [];
    const refundTotal = bookingRefunds.reduce((s, r) => s + r.amount, 0);
    const payoutDue = b.transferStatus !== 'PENDING';

    const payment = eventStatus(b.id, 'PAYMENT_RECEIVED');
    const refundEvents = bookingRefunds.map((r) => ({
      stripeRefundId: r.stripeRefundId,
      amountPence: r.amount,
      status: eventStatus(b.id, 'REFUND', r.stripeRefundId ?? ''),
    }));
    const payout: EventStatus = payoutDue ? eventStatus(b.id, 'PAYOUT') : { state: 'NOT DUE' };

    // Identity: what the window's money movements net to, vs what a COMPLETED
    // Xero mirror of those movements nets to. UNVERIFIED fees count as 0 on
    // both sides (flagged, never guessed).
    const fee = stripeFeePence ?? 0;
    const expected = gross - fee - refundTotal - (payoutDue ? cleanerNet : 0);
    let pushed = 0;
    if (payment.state === 'COMPLETED') pushed += gross - fee;
    for (const re of refundEvents) if (re.status.state === 'COMPLETED') pushed -= re.amountPence;
    if (payout.state === 'COMPLETED') pushed -= cleanerNet;
    expectedNetPence += expected;
    pushedNetPence += pushed;
    const diff = expected - pushed;
    const match = diff === 0 && stripeFeePence !== null;
    if (!match && stripeFeePence !== null) mismatches++;

    return {
      bookingId: b.id,
      createdAt: b.createdAt.toISOString(),
      serviceType: b.serviceType,
      paymentStatus: b.paymentStatus,
      grossPence: gross,
      splits: {
        commissionPence: commission,
        serviceFeePence: serviceFee,
        cleanerNetPence: cleanerNet,
        stripeFeePence:
          stripeFeePence ?? ('UNVERIFIED (no stored balance-transaction fee)' as const),
        internalIdentity: splitsOk ? 'OK (gross = platform take + cleaner net)' : 'BROKEN',
      },
      xero: { PAYMENT_RECEIVED: payment, REFUND: refundEvents, PAYOUT: payout },
      reconciliation: {
        flag: stripeFeePence === null ? 'UNVERIFIED' : diff === 0 ? 'MATCH' : 'MISMATCH',
        differencePence: diff,
      },
    };
  });

  const summary = {
    window: {
      since: since.toISOString(),
      definition: 'bookings created since the date with a succeeded payment (incl. later refunds)',
    },
    bookings: rows.length,
    identity: {
      expectedNetPence,
      pushedToXeroNetPence: pushedNetPence,
      differencePence: expectedNetPence - pushedNetPence,
      formula:
        'Σ(gross − stripe fee) − refunds − payouts, vs the COMPLETED Xero pushes of the same movements',
    },
    flags: { matches: rows.length - mismatches - unverified, mismatches, unverified },
    watchSet: {
      xeroPushFailures: failedPushesInWindow,
      recurringChargeFailures: chargeFailures,
      mintSkipped:
        'log-only signal — not DB-recorded; grep deploy logs for "[Recurring] mint SKIPPED"',
      cascadePartialSends:
        'log-only signal — not DB-recorded; grep deploy logs for "[Cascade]" N/M lines',
    },
  };

  if (asJson) {
    return NextResponse.json({ summary, bookings: rows });
  }

  const lines: string[] = [];
  lines.push(
    `RENA RECONCILIATION — since ${since.toISOString().slice(0, 10)} (window: ${summary.window.definition})`
  );
  lines.push(
    'READ-ONLY. Stripe fees come from stored balance-transaction data; no live Stripe calls.'
  );
  lines.push('');
  for (const r of rows) {
    const s = r.splits;
    lines.push(
      `${r.bookingId}  [${r.serviceType} · ${r.paymentStatus} · ${r.createdAt.slice(0, 10)}]`
    );
    lines.push(
      `  gross ${gbp(r.grossPence)} = cleaner ${gbp(s.cleanerNetPence)} + commission ${gbp(s.commissionPence)} + service fee ${gbp(s.serviceFeePence)}  · splits ${s.internalIdentity}`
    );
    lines.push(
      `  stripe fee: ${typeof s.stripeFeePence === 'number' ? gbp(s.stripeFeePence) : s.stripeFeePence}`
    );
    const evLine = (name: string, e: EventStatus) =>
      `  xero ${name}: ${e.state}${'xeroId' in e && e.xeroId ? ` (${e.xeroId})` : ''}${'reason' in e ? ` — ${e.reason}` : ''}`;
    lines.push(evLine('PAYMENT_RECEIVED', r.xero.PAYMENT_RECEIVED));
    for (const re of r.xero.REFUND) {
      lines.push(
        `${evLine('REFUND', re.status)} · ${gbp(re.amountPence)} (${re.stripeRefundId ?? 'no stripe id'})`
      );
    }
    lines.push(evLine('PAYOUT', r.xero.PAYOUT));
    lines.push(
      `  RECONCILIATION: ${r.reconciliation.flag}${r.reconciliation.flag === 'MISMATCH' ? ` — off by ${r.reconciliation.differencePence}p` : ''}`
    );
    lines.push('');
  }
  lines.push('── IDENTITY CHECK ──');
  lines.push(`  ${summary.identity.formula}`);
  lines.push(
    `  expected net ${gbp(expectedNetPence)}  vs  pushed to Xero ${gbp(pushedNetPence)}  →  difference ${summary.identity.differencePence}p`
  );
  lines.push(
    `  per-booking: ${summary.flags.matches} MATCH · ${summary.flags.mismatches} MISMATCH · ${summary.flags.unverified} UNVERIFIED`
  );
  lines.push('');
  lines.push('── WATCH-SET (window) ──');
  lines.push(`  xero push failures: ${failedPushesInWindow}`);
  lines.push(`  recurring-charge failures: ${chargeFailures}`);
  lines.push(`  mint SKIPPEDs: ${summary.watchSet.mintSkipped}`);
  lines.push(`  cascade partial sends: ${summary.watchSet.cascadePartialSends}`);
  lines.push('');
  lines.push('(?format=json for the machine-readable version)');

  return new NextResponse(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
