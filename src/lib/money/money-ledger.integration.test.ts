import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as CancellationModule from '@/lib/services/cancellation.service';
import type * as DisputeModule from '@/lib/services/dispute-resolution.service';
import type * as HoldsModule from '@/lib/services/money-holds.service';
import type * as PaymentModule from '@/lib/services/payment-success.service';
import type * as RecurringModule from '@/lib/services/recurring-charge.service';
import type * as RefundModule from '@/lib/services/refund.service';
import type * as TransferModule from '@/lib/services/transfer.service';

import type * as AbnormalModule from './abnormal-states';
import type * as ActionsModule from './stuck-money-actions';
import { sharedFake as fake } from './testing/stripe-fake';

// B4.11 (RENA-016): the money ledger against a real Postgres, Stripe faked at
// the SDK boundary (a scripted in-memory Stripe that honours idempotency keys
// and can lose a response after the call landed). Opt-in: runs only when
// MONEY_LEDGER_INTEGRATION=1 and DATABASE_URL point at a migrated database
// (the rig, or the CI e2e job's service container). Synthetic users only
// (@integration.invalid); no real person, no real Stripe, no live key.
vi.mock('@/lib/stripe', async () => {
  const m = await import('./testing/stripe-fake');
  return { default: m.sharedFake };
});

const enabled = process.env.MONEY_LEDGER_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const REPS = Number(process.env.MONEY_LEDGER_REPS || 15);
const EMAILS = {
  cleaner: 'b4-cleaner@integration.invalid',
  customer: 'b4-customer@integration.invalid',
  admin: 'b4-admin@integration.invalid',
};
const ACCT = 'acct_fake_b4_integration';
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!enabled)('money ledger against Postgres (B4)', () => {
  let prisma: typeof PrismaDefault;
  let refund: typeof RefundModule;
  let transfer: typeof TransferModule;
  let dispute: typeof DisputeModule;
  let holds: typeof HoldsModule;
  let payment: typeof PaymentModule;
  let cancellation: typeof CancellationModule;
  let recurring: typeof RecurringModule;
  let abnormal: typeof AbnormalModule;
  let actions: typeof ActionsModule;
  const ids = { cleaner: '', customer: '', admin: '' };
  const startedAt = new Date();
  let n = 0;

  async function userIds(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(EMAILS) } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async function wipeBookings(): Promise<void> {
    const uids = await userIds();
    if (!uids.length) return;
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ cleanerId: { in: uids } }, { clientId: { in: uids } }] },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await prisma.recurringAgreement.deleteMany({ where: { cleanerId: { in: uids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: uids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
    await prisma.backgroundJob.deleteMany({ where: { createdAt: { gte: startedAt } } });
  }

  async function cleanup(): Promise<void> {
    await wipeBookings();
    const uids = await userIds();
    if (uids.length) {
      await prisma.cleanerProfile.deleteMany({ where: { userId: { in: uids } } });
      await prisma.user.deleteMany({ where: { id: { in: uids } } });
    }
  }

  /**
   * A paid booking: the original charge plus optional succeeded top-ups (each
   * its own payment intent and charge), registered in the fake Stripe.
   */
  async function paidBooking(
    opts: {
      originalPence?: number;
      earningsPence?: number;
      status?: string;
      transferStatus?: string;
      topups?: { pence: number; flagged?: boolean }[];
      extra?: Record<string, unknown>;
    } = {}
  ): Promise<{
    id: string;
    pi: string;
    charge: string;
    topups: { pi: string; charge: string; id: string }[];
  }> {
    n += 1;
    const tag = `${Date.now().toString(36)}${n}`;
    const original = opts.originalPence ?? 6000;
    const topups = opts.topups ?? [];
    const charged = original + topups.reduce((s, t) => s + t.pence, 0);
    const pi = `pi_b4_${tag}`;
    const charge = `ch_b4_${tag}`;
    fake.addPaymentIntent({ id: pi, amount: original, latest_charge: charge });
    const b = await prisma.booking.create({
      data: {
        clientId: ids.customer,
        cleanerId: ids.cleaner,
        serviceType: 'regular',
        date: new Date(Date.now() + 10 * DAY_MS),
        startTime: '10:00',
        duration: 3,
        totalPrice: charged / 100,
        totalAmountCharged: charged / 100,
        platformFee: (charged - (opts.earningsPence ?? 5000)) / 100,
        cleanerEarnings: (opts.earningsPence ?? 5000) / 100,
        status: (opts.status ?? 'COMPLETED') as never,
        paymentStatus: 'SUCCEEDED',
        transferStatus: (opts.transferStatus ?? 'PENDING') as never,
        stripePaymentIntentId: pi,
        stripeChargeId: charge,
        completedAt: new Date(),
        addressPostcode: 'E4 7AA',
        addressCity: 'London',
        ...(opts.extra ?? {}),
      },
    });
    const made: { pi: string; charge: string; id: string }[] = [];
    for (let i = 0; i < topups.length; i++) {
      const t = topups[i];
      const tpi = `pi_b4_${tag}_t${i}`;
      const tch = `ch_b4_${tag}_t${i}`;
      fake.addPaymentIntent({ id: tpi, amount: t.pence, latest_charge: tch });
      const rec = await prisma.topupRecord.create({
        data: {
          bookingId: b.id,
          stripePaymentIntentId: tpi,
          stripeChargeId: tch,
          amount: t.pence / 100,
          reason: 'integration top-up',
          status: 'SUCCEEDED',
          failureReason: t.flagged ? 'TOPUP_WITHOUT_ASSIGNMENT: SLOT_TAKEN' : null,
          createdAt: new Date(Date.now() + (i + 1) * 1000),
        },
      });
      made.push({ pi: tpi, charge: tch, id: rec.id });
    }
    return { id: b.id, pi, charge, topups: made };
  }

  async function bookingRow(id: string) {
    return prisma.booking.findUniqueOrThrow({ where: { id } });
  }

  async function slicesOf(bookingId: string) {
    return prisma.refundSlice.findMany({
      where: { record: { bookingId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'integration-secret';
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_unused';
    prisma = (await import('@/lib/db/prisma')).default;
    refund = await import('@/lib/services/refund.service');
    transfer = await import('@/lib/services/transfer.service');
    dispute = await import('@/lib/services/dispute-resolution.service');
    holds = await import('@/lib/services/money-holds.service');
    payment = await import('@/lib/services/payment-success.service');
    cancellation = await import('@/lib/services/cancellation.service');
    recurring = await import('@/lib/services/recurring-charge.service');
    abnormal = await import('./abnormal-states');
    actions = await import('./stuck-money-actions');
    await cleanup();
    const cleaner = await prisma.user.create({
      data: {
        email: EMAILS.cleaner,
        name: 'Integration Cleaner',
        role: 'CLEANER',
        passwordHash: 'x',
        emailVerified: new Date(),
      },
    });
    await prisma.cleanerProfile.create({
      data: {
        userId: cleaner.id,
        verified: true,
        hourlyRateRegular: 20,
        stripeAccountId: ACCT,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        bookingBufferMinutes: 30,
        availabilitySlots: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            startTime: '00:00',
            endTime: '23:59',
          })),
        },
      },
    });
    ids.cleaner = cleaner.id;
    const customer = await prisma.user.create({
      data: {
        email: EMAILS.customer,
        name: 'Integration Customer',
        role: 'CLIENT',
        passwordHash: 'x',
        emailVerified: new Date(),
        stripeCustomerId: 'cus_fake_b4_integration',
      },
    });
    ids.customer = customer.id;
    const admin = await prisma.user.create({
      data: {
        email: EMAILS.admin,
        name: 'Integration Admin',
        role: 'ADMIN',
        passwordHash: 'x',
        emailVerified: new Date(),
      },
    });
    ids.admin = admin.id;
  }, 60_000);

  beforeEach(async () => {
    fake.reset();
    await wipeBookings();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  }, 60_000);

  // ─── 1 ──────────────────────────────────────────────────────

  it(`1. duplicate charge.refunded delivered twice concurrently: one confirmation, one state, no throw (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      fake.reset();
      await wipeBookings();
      const b = await paidBooking();
      fake.refundStatusOnCreate = 'pending';
      const r = await refund.refundBooking(b.id, 20, 'integration partial');
      expect(r.status).toBe('FAILED');
      expect(r.code).toBe('OUTCOME_UNKNOWN');
      const [slice] = await slicesOf(b.id);
      expect(slice.status).toBe('PENDING');
      // Stripe settles it; the event arrives twice at once.
      Array.from(fake.refundsById.values()).forEach((re) => (re.status = 'succeeded'));
      const event = fake.chargeRefundedEvent(b.charge, b.pi, 6000);
      await Promise.all([refund.handleChargeRefunded(event), refund.handleChargeRefunded(event)]);
      const after = await slicesOf(b.id);
      expect(after).toHaveLength(1);
      expect(after[0].status).toBe('SUCCEEDED');
      expect(after[0].executedPence).toBe(2000);
      expect((await bookingRow(b.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
      const recs = await prisma.refundRecord.findMany({ where: { bookingId: b.id } });
      expect(recs).toHaveLength(1);
      expect(recs[0].executedPence).toBe(2000);
      expect(recs[0].finalizedExecutedPence).toBe(2000);
      // The consequences ran exactly once: one customer refund notice.
      const notices = await prisma.notification.findMany({
        where: { userId: ids.customer, title: { contains: 'refund issued' } },
      });
      expect(
        notices.filter((x) => (x.data as { bookingId?: string } | null)?.bookingId === b.id)
      ).toHaveLength(1);
    }
    // A dashboard refund delivered twice at once records one STRIPE_DASHBOARD row.
    fake.reset();
    await wipeBookings();
    const d = await paidBooking();
    fake.addDashboardRefund(d.pi, d.charge, 1500);
    const ev = fake.chargeRefundedEvent(d.charge, d.pi, 6000);
    await Promise.all([refund.handleChargeRefunded(ev), refund.handleChargeRefunded(ev)]);
    const dash = await prisma.refundRecord.findMany({
      where: { bookingId: d.id, triggeredBy: 'STRIPE_DASHBOARD' },
    });
    expect(dash).toHaveLength(1);
    expect((await bookingRow(d.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
  }, 300_000);

  // ─── 2 ──────────────────────────────────────────────────────

  it(`2. cancel versus payment_intent.succeeded: never a paid CANCELLED booking without a refund (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      fake.reset();
      await wipeBookings();
      n += 1;
      const pi = `pi_b4_race_${n}`;
      const ch = `ch_b4_race_${n}`;
      // The customer paid at Stripe; the webhook and their cancel race.
      fake.addPaymentIntent({ id: pi, amount: 6000, latest_charge: ch, status: 'succeeded' });
      const b = await prisma.booking.create({
        data: {
          clientId: ids.customer,
          cleanerId: ids.cleaner,
          serviceType: 'regular',
          date: new Date(Date.now() + 10 * DAY_MS),
          startTime: '10:00',
          duration: 3,
          totalPrice: 60,
          platformFee: 10,
          cleanerEarnings: 50,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          stripePaymentIntentId: pi,
          addressPostcode: 'E4 7AA',
          addressCity: 'London',
        },
      });
      const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15)));
      await Promise.all([
        jitter().then(() =>
          cancellation.executeCancellation({ bookingId: b.id, cancelledBy: 'client' })
        ),
        jitter().then(() =>
          payment.processPaymentSuccess({
            bookingId: b.id,
            pi: {
              id: pi,
              created: Math.floor(Date.now() / 1000),
              currency: 'gbp',
              amountReceived: 6000,
              chargeId: ch,
            },
          })
        ),
      ]);
      const row = await bookingRow(b.id);
      const executed = await prisma.refundSlice.aggregate({
        where: { record: { bookingId: b.id }, status: 'SUCCEEDED' },
        _sum: { executedPence: true },
      });
      const refunded = executed._sum.executedPence ?? 0;
      // Never more than was charged.
      expect(refunded).toBeLessThanOrEqual(6000);
      if (row.status === 'CANCELLED') {
        // Cancelled with the money returned in full (the fence or the late-payment refund).
        expect(refunded).toBe(6000);
      } else {
        expect(['AWAITING_CLEANER', 'ACCEPTED', 'CONFIRMED']).toContain(row.status);
        expect(row.paymentStatus).toBe('SUCCEEDED');
        expect(refunded).toBe(0);
      }
    }
  }, 300_000);

  // ─── 3 ──────────────────────────────────────────────────────

  it('3. original plus top-up: LIFO slices, REFUNDED only when all charged money is executed; a dashboard refund of the original alone is PARTIALLY_REFUNDED', async () => {
    const b = await paidBooking({ originalPence: 6000, topups: [{ pence: 2000 }] });
    const a = await refund.refundBooking(b.id, 10, 'within the top-up');
    expect(a.status).toBe('PARTIALLY_REFUNDED');
    let s = await slicesOf(b.id);
    expect(s).toHaveLength(1);
    expect(s[0].stripePaymentIntentId).toBe(b.topups[0].pi);
    const c = await refund.refundBooking(b.id, 30, 'across both');
    expect(c.status).toBe('PARTIALLY_REFUNDED');
    s = await slicesOf(b.id);
    expect(s).toHaveLength(3);
    const second = s.slice(1);
    expect(second.map((x) => [x.stripePaymentIntentId, x.requestedPence])).toEqual([
      [b.topups[0].pi, 1000],
      [b.pi, 2000],
    ]);
    expect((await bookingRow(b.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
    const d = await refund.refundBooking(b.id, 40, 'the rest');
    expect(d.status).toBe('REFUNDED');
    expect((await bookingRow(b.id)).paymentStatus).toBe('REFUNDED');
    const total = (await slicesOf(b.id)).reduce((t, x) => t + x.executedPence, 0);
    expect(total).toBe(8000);
    // One more penny is refused.
    const e = await refund.refundBooking(b.id, 0.01, 'over');
    expect(e.status).not.toBe('REFUNDED');

    const o = await paidBooking({ originalPence: 6000, topups: [{ pence: 2000 }] });
    fake.addDashboardRefund(o.pi, o.charge, 6000);
    await refund.handleChargeRefunded(fake.chargeRefundedEvent(o.charge, o.pi, 6000));
    expect((await bookingRow(o.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
  });

  // ─── 4 ──────────────────────────────────────────────────────

  it('4. slice two fails after slice one: PARTIAL, then the remainder retry succeeds', async () => {
    const b = await paidBooking({ originalPence: 6000, topups: [{ pence: 2000 }] });
    fake.script('refunds.create', 'ok', 'definitive');
    const r = await refund.refundBooking(b.id, 30, 'two slices');
    expect(r.code).toBe('PARTIAL');
    let rec = await prisma.refundRecord.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(rec.status).toBe('PARTIAL');
    expect(rec.executedPence).toBe(2000);
    expect(rec.requestedPence).toBe(3000);
    expect((await bookingRow(b.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
    const retry = await refund.retryRefundRemainder(rec.id, ids.admin);
    expect(retry.status).toBe('PARTIALLY_REFUNDED');
    rec = await prisma.refundRecord.findFirstOrThrow({ where: { id: rec.id } });
    expect(rec.status).toBe('SUCCEEDED');
    expect(rec.executedPence).toBe(3000);
    expect((await bookingRow(b.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
  });

  // ─── 5 ──────────────────────────────────────────────────────

  it('5. anchored plus top-up slices, then a full post-release refund reverses each slice proportionally with its own key', async () => {
    const b = await paidBooking({
      originalPence: 6000,
      earningsPence: 7000,
      topups: [{ pence: 2000 }],
    });
    const rel = await transfer.releaseBookingFunds(b.id, { trigger: 'SYSTEM' });
    expect(rel.status).toBe('RELEASED');
    const slices = await prisma.transferSlice.findMany({
      where: { bookingId: b.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(slices.map((x) => [x.kind, x.sourceChargeId, x.amountPence])).toEqual([
      ['ANCHORED', b.charge, 6000],
      ['ANCHORED', b.topups[0].charge, 1000],
    ]);
    const full = await refund.refundBooking(b.id, 80, 'full after release');
    expect(full.status).toBe('REFUNDED');
    const reversals = await prisma.transferReversal.findMany({
      where: { refundRecordId: full.refundRecordId },
    });
    expect(reversals.reduce((t, v) => t + v.amountPence, 0)).toBe(7000);
    expect(new Set(reversals.map((v) => v.idempotencyKey)).size).toBe(2);
    const after = await prisma.transferSlice.findMany({ where: { bookingId: b.id } });
    expect(after.every((x) => x.status === 'REVERSED')).toBe(true);

    // A single-slice booking: a partial refund reverses the computed share.
    const p = await paidBooking({ originalPence: 6000, earningsPence: 5000 });
    expect((await transfer.releaseBookingFunds(p.id, { trigger: 'SYSTEM' })).status).toBe(
      'RELEASED'
    );
    const part = await refund.refundBooking(p.id, 30, 'half after release');
    expect(part.status).toBe('PARTIALLY_REFUNDED');
    const rv = await prisma.transferReversal.findMany({
      where: { refundRecordId: part.refundRecordId },
    });
    expect(rv.reduce((t, v) => t + v.amountPence, 0)).toBe(2500);
  });

  // ─── 6 ──────────────────────────────────────────────────────

  it('6a. refund unknown: a lost response twice is UNKNOWN, blocks new refunds, and reconciles to SUCCEEDED from Stripe', async () => {
    const b = await paidBooking();
    fake.script('refunds.create', 'lost', 'lost');
    const r = await refund.refundBooking(b.id, 20, 'lost twice');
    expect(r.code).toBe('OUTCOME_UNKNOWN');
    const [slice] = await slicesOf(b.id);
    expect(slice.status).toBe('UNKNOWN');
    // Both calls carried the same key.
    const keys = fake.callsTo('refunds.create').map((c) => c.key);
    expect(new Set(keys).size).toBe(1);
    expect(await refund.remainingRefundableFor(b.id)).toBeNull();
    const blocked = await refund.refundBooking(b.id, 5, 'while unknown');
    expect(blocked.code).toBe(refund.LEDGER_RECONCILIATION_PENDING);
    expect(await refund.reconcileRefundSlice(slice.id)).toBe('SUCCEEDED');
    expect((await bookingRow(b.id)).paymentStatus).toBe('PARTIALLY_REFUNDED');
    expect(await refund.remainingRefundableFor(b.id)).toBe(4000);
    // Reconciliation never re-executes.
    expect(fake.callsTo('refunds.create')).toHaveLength(2);
  });

  it('6b. refund unknown that never reached Stripe: stays UNKNOWN inside 24h, FAILED after', async () => {
    const b = await paidBooking();
    fake.script('refunds.create', 'connection', 'connection');
    await refund.refundBooking(b.id, 20, 'never landed');
    const [slice] = await slicesOf(b.id);
    expect(slice.status).toBe('UNKNOWN');
    expect(await refund.reconcileRefundSlice(slice.id)).toBe('UNKNOWN');
    await prisma.refundRecord.update({
      where: { id: slice.refundRecordId },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expect(await refund.reconcileRefundSlice(slice.id)).toBe('FAILED');
    expect(await refund.remainingRefundableFor(b.id)).toBe(6000);
    expect((await bookingRow(b.id)).transferStatus).toBe('PENDING');
  });

  it('6c. reversal unknown: reconciled from the transfer, then the remainder retry sends the refund without reversing twice', async () => {
    const b = await paidBooking();
    expect((await transfer.releaseBookingFunds(b.id, { trigger: 'SYSTEM' })).status).toBe(
      'RELEASED'
    );
    fake.script('transfers.createReversal', 'lost', 'lost');
    const r = await refund.refundBooking(b.id, 60, 'full, reversal lost');
    expect(r.code).toBe('OUTCOME_UNKNOWN');
    const [row] = await prisma.transferReversal.findMany({
      where: { refundRecordId: r.refundRecordId },
    });
    expect(row.status).toBe('UNKNOWN');
    expect(await refund.reconcileReversal(row.id)).toBe('SUCCEEDED');
    const rec = await prisma.refundRecord.findUniqueOrThrow({ where: { id: r.refundRecordId } });
    expect(rec.status).toBe('FAILED');
    const retry = await refund.retryRefundRemainder(rec.id, ids.admin);
    expect(retry.status).toBe('REFUNDED');
    const reversed = await prisma.transferReversal.aggregate({
      where: { refundRecordId: r.refundRecordId, status: 'SUCCEEDED' },
      _sum: { amountPence: true },
    });
    expect(reversed._sum.amountPence).toBe(5000);
  });

  it('6d. transfer unknown: the next release reconciles the transfer group and never pays twice', async () => {
    const b = await paidBooking();
    fake.script('transfers.create', 'lost', 'lost');
    const first = await transfer.releaseBookingFunds(b.id, { trigger: 'SYSTEM' });
    expect(first.status).toBe('UNKNOWN');
    expect((await bookingRow(b.id)).transferStatus).toBe('UNKNOWN');
    const again = await transfer.releaseBookingFunds(b.id, { trigger: 'SYSTEM' });
    expect(again.status).toBe('RELEASED');
    expect(fake.transfersById.size).toBe(1);
    const keys = fake.callsTo('transfers.create').map((c) => c.key);
    expect(new Set(keys).size).toBe(1);
  });

  // ─── 7 ──────────────────────────────────────────────────────

  async function disputed(extra: Record<string, unknown> = {}) {
    const b = await paidBooking({ status: 'DISPUTED', transferStatus: 'PAUSED', extra });
    const d = await prisma.dispute.create({
      data: {
        bookingId: b.id,
        raisedById: ids.customer,
        reason: 'QUALITY',
        description: 'integration dispute',
        status: 'UNDER_REVIEW',
      },
    });
    return { ...b, disputeId: d.id };
  }

  it('7a. dispute refund fails after the transition: stays RESOLVING_REFUND, the retry job resolves it', async () => {
    const b = await disputed();
    fake.script('refunds.create', 'definitive');
    const r = await dispute.startDisputeResolution({
      disputeId: b.disputeId,
      outcome: 'refund-customer',
      resolution: 'integration refund',
      adminId: ids.admin,
    });
    expect(r.disputeStatus).toBe('RESOLVING_REFUND');
    let d = await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } });
    expect(d.lastMoneyError).toBeTruthy();
    expect((await bookingRow(b.id)).status).toBe('CANCELLED');
    await prisma.dispute.update({
      where: { id: d.id },
      data: {
        resolvingSince: new Date(Date.now() - 5 * 60_000),
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });
    const job = await dispute.retryResolvingDisputes();
    expect(job.processed).toBe(1);
    d = await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } });
    expect(d.status).toBe('RESOLVED');
    expect((await bookingRow(b.id)).paymentStatus).toBe('REFUNDED');
    // One record, retried under its own keys.
    expect(await prisma.refundRecord.count({ where: { bookingId: b.id } })).toBe(1);
  });

  it(`7b. two resolves at once: one wins, the other is a conflict with nothing written (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      fake.reset();
      await wipeBookings();
      const b = await disputed();
      const results = await Promise.allSettled([
        dispute.startDisputeResolution({
          disputeId: b.disputeId,
          outcome: 'refund-customer',
          resolution: 'a',
          adminId: ids.admin,
        }),
        dispute.startDisputeResolution({
          disputeId: b.disputeId,
          outcome: 'release-to-cleaner',
          resolution: 'b',
          adminId: ids.admin,
        }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const bad = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(ok).toHaveLength(1);
      expect(bad).toHaveLength(1);
      expect(bad[0].reason).toBeInstanceOf(dispute.DisputeConflictError);
      const d = await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } });
      const winner = (ok[0] as PromiseFulfilledResult<{ outcome: string }>).value.outcome;
      expect(d.resolutionOutcome).toBe(winner);
      expect(await prisma.refundRecord.count({ where: { bookingId: b.id } })).toBe(
        winner === 'refund-customer' ? 1 : 0
      );
    }
  }, 300_000);

  it('7c. split crosses RESOLVING_REFUND, RESOLVING_RELEASE, RESOLVED; a release failure stays RESOLVING_RELEASE and retries', async () => {
    const b = await disputed();
    fake.script('transfers.create', 'definitive');
    const r = await dispute.startDisputeResolution({
      disputeId: b.disputeId,
      outcome: 'split',
      resolution: 'integration split',
      refundAmount: 20,
      adminId: ids.admin,
    });
    expect(r.refundStatus).toBe('SUCCEEDED');
    expect(r.disputeStatus).toBe('RESOLVING_RELEASE');
    await prisma.dispute.update({
      where: { id: b.disputeId },
      data: {
        resolvingSince: new Date(Date.now() - 5 * 60_000),
        nextRetryAt: new Date(Date.now() - 1000),
      },
    });
    await dispute.retryResolvingDisputes();
    const d = await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } });
    expect(d.status).toBe('RESOLVED');
    const row = await bookingRow(b.id);
    expect(row.transferStatus).toBe('RELEASED');
    expect(row.paymentStatus).toBe('PARTIALLY_REFUNDED');
    // The reduced share was paid: 50 less the cleaner's share of 20 of 60.
    const paid = Array.from(fake.transfersById.values()).reduce((t, x) => t + x.amount, 0);
    expect(paid).toBe(5000 - Math.round((5000 * 2000) / 6000));
  });

  // ─── 8 ──────────────────────────────────────────────────────

  it('8. a shortfall pauses release and writes the field; an equal amount does not; clearing it releases', async () => {
    const make = async (startTime: string) => {
      n += 1;
      const pi = `pi_b4_sf_${n}`;
      fake.addPaymentIntent({ id: pi, amount: 6000, latest_charge: `ch_b4_sf_${n}` });
      return prisma.booking.create({
        data: {
          clientId: ids.customer,
          cleanerId: ids.cleaner,
          serviceType: 'regular',
          date: new Date(Date.now() + 10 * DAY_MS),
          startTime,
          duration: 3,
          totalPrice: 60,
          platformFee: 10,
          cleanerEarnings: 50,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          stripePaymentIntentId: pi,
          addressPostcode: 'E4 7AA',
          addressCity: 'London',
        },
      });
    };
    const short = await make('08:00');
    await payment.processPaymentSuccess({
      bookingId: short.id,
      pi: {
        id: short.stripePaymentIntentId as string,
        created: 1,
        currency: 'gbp',
        amountReceived: 5500,
        chargeId: `ch_b4_sf_${n}`,
      },
    });
    let row = await bookingRow(short.id);
    expect(row.amountShortfallPence).toBe(500);
    expect(row.transferStatus).toBe('PAUSED');
    const equal = await make('15:00');
    await payment.processPaymentSuccess({
      bookingId: equal.id,
      pi: {
        id: equal.stripePaymentIntentId as string,
        created: 1,
        currency: 'gbp',
        amountReceived: 6000,
        chargeId: `ch_b4_sf_${n}`,
      },
    });
    row = await bookingRow(equal.id);
    expect(row.amountShortfallPence).toBeNull();
    expect(row.transferStatus).toBe('PENDING');
    await prisma.booking.update({ where: { id: short.id }, data: { status: 'COMPLETED' } });
    expect((await transfer.resumePausedRelease(short.id)).status).toBe('SKIPPED');
    const cleared = await holds.clearShortfall(short.id, ids.admin);
    expect(cleared.ok).toBe(true);
    expect((await bookingRow(short.id)).transferStatus).toBe('RELEASED');
  });

  // ─── 9 ──────────────────────────────────────────────────────

  it('9. add-on splits: the parent rate (90 hourly, 85 fixed), an own split honoured, products 90; the transfer equals cleanerEarnings', async () => {
    const { pricingService, addonSplit } = await import('@/lib/services/pricing.service');
    const { computeMoneySnapshot } = await import('@/lib/services/money-snapshot.service');
    const { getTransferAmountPence } = await import('@/lib/services/transfer-amount');
    // Pure: the split per add-on, rounded per add-on, share + commission = price.
    expect(addonSplit(['a'], [{ id: 'a', price: 20 }], 0.1)).toEqual({
      total: 20,
      cleanerShare: 18,
      commission: 2,
    });
    expect(addonSplit(['a'], [{ id: 'a', price: 40 }], 0.15)).toEqual({
      total: 40,
      cleanerShare: 34,
      commission: 6,
    });
    expect(
      addonSplit(
        ['a', 'b'],
        [
          { id: 'a', price: 20 },
          { id: 'b', price: 10, cleanerSharePct: '0.5' },
        ],
        0.1
      )
    ).toEqual({ total: 30, cleanerShare: 23, commission: 7 });
    expect(addonSplit(['x'], [{ id: 'a', price: 20 }], 0.1)).toEqual({
      total: 0,
      cleanerShare: 0,
      commission: 0,
    });

    await prisma.cleanerProfile.update({
      where: { userId: ids.cleaner },
      data: { eotPrices: { '2bed': 200 } },
    });
    const regular = await prisma.serviceType.findUniqueOrThrow({ where: { slug: 'regular' } });
    const eot = await prisma.serviceType.findUniqueOrThrow({ where: { slug: 'eot' } });
    const made = await Promise.all([
      prisma.serviceAddon.create({
        data: { serviceTypeId: regular.id, name: 'B4 test parent rate', price: 20 },
      }),
      prisma.serviceAddon.create({
        data: {
          serviceTypeId: regular.id,
          name: 'B4 test own split',
          price: 10,
          cleanerSharePct: 0.5,
        },
      }),
      prisma.serviceAddon.create({
        data: { serviceTypeId: eot.id, name: 'B4 test eot', price: 40 },
      }),
    ]);
    try {
      const hourly = await pricingService.calculateQuote({
        cleanerId: ids.cleaner,
        serviceSlug: 'regular',
        hours: 3,
        addons: [made[0].id, made[1].id, 'products'],
      });
      // £60 clean less 10% = 54; add-ons 18 + 5; products 4.50.
      expect(hourly.addonCleanerShare).toBe(23);
      expect(hourly.addonCommission).toBe(7);
      expect(hourly.cleanerPayout).toBe(81.5);
      expect(hourly.cleanerCommission).toBe(6 + 0.5 + 7);
      const fixed = await pricingService.calculateQuote({
        cleanerId: ids.cleaner,
        serviceSlug: 'eot',
        propertySize: '2bed',
        addons: [made[2].id],
      });
      // £200 less 15% = 170; add-on 40 at 85% = 34.
      expect(fixed.addonCleanerShare).toBe(34);
      expect(fixed.cleanerPayout).toBe(204);
      const snap = await computeMoneySnapshot({
        cleanerId: ids.cleaner,
        serviceType: 'regular',
        duration: 3,
        extras: [made[0].id, made[1].id, 'products'],
      } as never);
      expect(snap.cleanerEarnings).toBe(hourly.cleanerPayout);
      expect(getTransferAmountPence(snap.cleanerEarnings)).toBe(8150);
    } finally {
      await prisma.serviceAddon.deleteMany({ where: { id: { in: made.map((m) => m.id) } } });
    }
  });

  // ─── N7 chargebacks ─────────────────────────────────────────

  it('N7. a chargeback holds an unreleased payout until won; after release it is CHARGEBACK_AFTER_RELEASE', async () => {
    const b = await paidBooking();
    await holds.recordChargeback({
      id: `dp_${b.id}`,
      charge: b.charge,
      amount: 6000,
      status: 'needs_response',
    } as never);
    expect((await bookingRow(b.id)).transferStatus).toBe('PAUSED');
    expect((await transfer.releaseBookingFunds(b.id)).status).toBe('SKIPPED');
    await holds.closeChargeback({
      id: `dp_${b.id}`,
      charge: b.charge,
      amount: 6000,
      status: 'won',
    } as never);
    expect((await bookingRow(b.id)).transferStatus).toBe('RELEASED');

    // Holds coexist (James-ruled): clearing a shortfall never releases money
    // an open chargeback still guards.
    const both = await paidBooking({
      transferStatus: 'PAUSED',
      extra: { amountShortfallPence: 200 },
    });
    await holds.recordChargeback({
      id: `dp_${both.id}`,
      charge: both.charge,
      amount: 5800,
      status: 'needs_response',
    } as never);
    expect((await holds.clearShortfall(both.id, ids.admin)).ok).toBe(true);
    expect((await bookingRow(both.id)).transferStatus).toBe('PAUSED');
    await holds.closeChargeback({
      id: `dp_${both.id}`,
      charge: both.charge,
      amount: 5800,
      status: 'won',
    } as never);
    expect((await bookingRow(both.id)).transferStatus).toBe('RELEASED');

    const lost = await paidBooking();
    await holds.recordChargeback({
      id: `dp_${lost.id}`,
      charge: lost.charge,
      amount: 6000,
      status: 'needs_response',
    } as never);
    await holds.closeChargeback({
      id: `dp_${lost.id}`,
      charge: lost.charge,
      amount: 6000,
      status: 'lost',
    } as never);
    expect((await bookingRow(lost.id)).transferStatus).toBe('PAUSED');

    const after = await paidBooking();
    await transfer.releaseBookingFunds(after.id);
    await holds.recordChargeback({
      id: `dp_${after.id}`,
      charge: after.charge,
      amount: 6000,
      status: 'needs_response',
    } as never);
    const h = await prisma.chargebackHold.findUniqueOrThrow({
      where: { stripeDisputeId: `dp_${after.id}` },
    });
    expect(h.status).toBe('AFTER_RELEASE');
    // A second delivery of the same event changes nothing.
    await holds.recordChargeback({
      id: `dp_${after.id}`,
      charge: after.charge,
      amount: 6000,
      status: 'needs_response',
    } as never);
    expect(await prisma.chargebackHold.count({ where: { bookingId: after.id } })).toBe(1);
  });

  // ─── N9 recurring unknown ───────────────────────────────────

  it('N9. a lost recurring charge goes UNKNOWN with no pay-now and no second key; the sweep reconciles it', async () => {
    const run = async (outcome: 'landed' | 'never') => {
      fake.reset();
      await wipeBookings();
      n += 1;
      const anchor = `pi_b4_anchor_${n}`;
      fake.addPaymentIntent({
        id: anchor,
        amount: 6000,
        payment_method: 'pm_fake_b4',
        customer: 'cus_fake_b4_integration',
      });
      fake.methodCustomer.set('pm_fake_b4', 'cus_fake_b4_integration');
      const agreement = await prisma.recurringAgreement.create({
        data: {
          clientId: ids.customer,
          cleanerId: ids.cleaner,
          serviceType: 'regular',
          frequency: 'WEEKLY',
          status: 'ACTIVE',
          startTime: '10:00',
          duration: 3,
          dayOfWeek: 1,
          addressLine1: 'Integration Street',
          addressPostcode: 'E4 7AA',
          totalPrice: 60,
          platformFee: 10,
          cleanerEarnings: 50,
        } as never,
      });
      await prisma.booking.create({
        data: {
          clientId: ids.customer,
          cleanerId: ids.cleaner,
          agreementId: agreement.id,
          serviceType: 'regular',
          date: new Date(Date.now() - 30 * DAY_MS),
          startTime: '10:00',
          duration: 3,
          totalPrice: 60,
          platformFee: 10,
          cleanerEarnings: 50,
          status: 'COMPLETED',
          paymentStatus: 'SUCCEEDED',
          stripePaymentIntentId: anchor,
          addressPostcode: 'E4 7AA',
          addressCity: 'London',
        },
      });
      const occ = await prisma.booking.create({
        data: {
          clientId: ids.customer,
          cleanerId: ids.cleaner,
          agreementId: agreement.id,
          serviceType: 'regular',
          date: new Date(Date.now() + 1.5 * DAY_MS),
          startTime: '10:00',
          duration: 3,
          totalPrice: 60,
          platformFee: 10,
          cleanerEarnings: 50,
          status: 'SCHEDULED',
          paymentStatus: 'PENDING',
          addressPostcode: 'E4 7AA',
          addressCity: 'London',
        },
      });
      fake.script(
        'paymentIntents.create',
        outcome === 'landed' ? 'lost' : 'connection',
        outcome === 'landed' ? 'lost' : 'connection'
      );
      const r = await recurring.attemptOccurrenceCharge(occ.id);
      expect(r).toBe('skipped');
      let row = await bookingRow(occ.id);
      expect(row.chargeOutcomeUnknownAt).not.toBeNull();
      expect(row.paymentStatus).toBe('PENDING');
      expect(new Set(fake.callsTo('paymentIntents.create').map((c) => c.key)).size).toBe(1);
      // Neither sweep touches it while unknown.
      await recurring.attemptOccurrenceCharge(occ.id);
      expect(fake.callsTo('paymentIntents.create')).toHaveLength(2);
      if (outcome === 'never') {
        await prisma.booking.update({
          where: { id: occ.id },
          data: { chargeOutcomeUnknownAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
        });
      }
      const rec = await recurring.reconcileUnknownOccurrenceCharge(occ.id);
      row = await bookingRow(occ.id);
      expect(row.chargeOutcomeUnknownAt).toBeNull();
      if (outcome === 'landed') {
        expect(rec).toBe('SUCCEEDED');
        expect(row.paymentStatus).toBe('SUCCEEDED');
      } else {
        expect(rec).toBe('FAILED');
        expect(row.paymentStatus).toBe('FAILED');
      }
      await prisma.booking.deleteMany({ where: { agreementId: agreement.id } });
      await prisma.recurringAgreement.delete({ where: { id: agreement.id } });
    };
    await run('landed');
    await run('never');
  });

  // ─── Gate review findings (Fable 5.1) ───────────────────────

  it(`R1. two remainder retries of one record at once: one runs, the remainder is refunded once (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      fake.reset();
      await wipeBookings();
      const b = await paidBooking({ originalPence: 6000, topups: [{ pence: 2000 }] });
      fake.script('refunds.create', 'ok', 'definitive');
      await refund.refundBooking(b.id, 30, 'two slices, second refused');
      const rec = await prisma.refundRecord.findFirstOrThrow({ where: { bookingId: b.id } });
      expect(rec.status).toBe('PARTIAL');
      const results = await Promise.all([
        refund.retryRefundRemainder(rec.id, ids.admin),
        refund.retryRefundRemainder(rec.id, ids.admin),
      ]);
      expect(results.filter((r) => r.status === 'PARTIALLY_REFUNDED')).toHaveLength(1);
      const executed = Array.from(fake.refundsById.values()).reduce((t, r) => t + r.amount, 0);
      expect(executed).toBe(3000);
      const after = await prisma.refundRecord.findUniqueOrThrow({ where: { id: rec.id } });
      expect(after.status).toBe('SUCCEEDED');
      expect(after.executedPence).toBe(3000);
    }
  }, 300_000);

  it('R2. a lost chargeback refuses every resume until an admin settles it', async () => {
    const b = await paidBooking({ transferStatus: 'PAUSED', extra: { amountShortfallPence: 100 } });
    const dp = { id: `dp_r2_${b.id}`, charge: b.charge, amount: 5900 };
    await holds.recordChargeback({ ...dp, status: 'needs_response' } as never);
    await holds.closeChargeback({ ...dp, status: 'lost' } as never);
    expect((await holds.clearShortfall(b.id, ids.admin)).ok).toBe(true);
    expect((await bookingRow(b.id)).transferStatus).toBe('PAUSED');
    expect((await holds.resumeIfUnheld(b.id, { trigger: 'ADMIN' })).status).toBe('SKIPPED');
    expect((await transfer.resumePausedRelease(b.id)).status).toBe('SKIPPED');
    const h = await prisma.chargebackHold.findUniqueOrThrow({ where: { stripeDisputeId: dp.id } });
    expect((await holds.settleLostChargeback(h.id, ids.admin)).ok).toBe(true);
    expect((await bookingRow(b.id)).transferStatus).toBe('RELEASED');
  });

  it(`R3. the dispute money step runs single flight: the retry job and an admin retry at once refund once (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      fake.reset();
      await wipeBookings();
      const b = await disputed();
      fake.script('refunds.create', 'definitive');
      await dispute.startDisputeResolution({
        disputeId: b.disputeId,
        outcome: 'split',
        resolution: 'r3',
        refundAmount: 20,
        adminId: ids.admin,
      });
      await prisma.dispute.update({
        where: { id: b.disputeId },
        data: { resolvingSince: new Date(Date.now() - 5 * 60_000), nextRetryAt: new Date(0) },
      });
      await Promise.all([
        dispute.retryResolvingDisputes(),
        dispute.runDisputeMoneyStep(b.disputeId),
      ]);
      // Whatever ran, the customer was refunded the split amount exactly once.
      const refunded = Array.from(fake.refundsById.values()).reduce((t, r) => t + r.amount, 0);
      expect(refunded).toBe(2000);
      expect(
        await prisma.refundRecord.count({ where: { bookingId: b.id, status: { not: 'FAILED' } } })
      ).toBeLessThanOrEqual(1);
      const d = await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } });
      expect(d.moneyStepLockedAt).toBeNull();
      if (d.status !== 'RESOLVED') {
        await dispute.runDisputeMoneyStep(b.disputeId);
        expect(
          (await prisma.dispute.findUniqueOrThrow({ where: { id: b.disputeId } })).status
        ).toBe('RESOLVED');
      }
      expect(Array.from(fake.refundsById.values()).reduce((t, r) => t + r.amount, 0)).toBe(2000);
    }
  }, 300_000);

  it('R4 and R5. a split of the whole remainder is refused; PAUSED with no hold is listed and resumes', async () => {
    const b = await disputed();
    await expect(
      dispute.startDisputeResolution({
        disputeId: b.disputeId,
        outcome: 'split',
        resolution: 'everything',
        refundAmount: 60,
        adminId: ids.admin,
      })
    ).rejects.toThrow(/refund-customer/);
    const stray = await paidBooking({ transferStatus: 'PAUSED' });
    const rows = await abnormal.listAbnormalStates();
    const row = rows.find((r) => r.state === 'TRANSFER_PAUSED_NO_HOLD' && r.bookingId === stray.id);
    expect(row?.actions).toEqual(['RESUME_RELEASE']);
    const res = await actions.runStuckMoneyAction('RESUME_RELEASE', stray.id, stray.id, ids.admin);
    expect(res.ok).toBe(true);
    expect((await bookingRow(stray.id)).transferStatus).toBe('RELEASED');
  });

  it('R6. a parked slice: the admin matches a refund id (Stripe read first) or records it not executed', async () => {
    const b = await paidBooking();
    fake.script('refunds.create', 'lost', 'lost');
    await refund.refundBooking(b.id, 20, 'parked');
    const [slice] = await slicesOf(b.id);
    await prisma.refundSlice.update({
      where: { id: slice.id },
      data: { status: 'NEEDS_RECONCILE' },
    });
    const landed = Array.from(fake.refundsById.values())[0];
    const wrong = await actions.runStuckMoneyAction(
      'ATTACH_REFUND_ID',
      b.id,
      slice.id,
      ids.admin,
      're_not_this_one'
    );
    expect(wrong.ok).toBe(false);
    const ok = await actions.runStuckMoneyAction(
      'ATTACH_REFUND_ID',
      b.id,
      slice.id,
      ids.admin,
      landed.id
    );
    expect(ok.ok).toBe(true);
    expect((await slicesOf(b.id))[0].status).toBe('SUCCEEDED');
    expect(await refund.remainingRefundableFor(b.id)).toBe(4000);

    const c = await paidBooking();
    fake.script('refunds.create', 'connection', 'connection');
    await refund.refundBooking(c.id, 20, 'never landed');
    const [s2] = await slicesOf(c.id);
    const marked = await actions.runStuckMoneyAction(
      'MARK_SLICE_NOT_EXECUTED',
      c.id,
      s2.id,
      ids.admin
    );
    expect(marked.ok).toBe(true);
    expect(await refund.remainingRefundableFor(c.id)).toBe(6000);
  });

  it('R7. a full dashboard refund before release stops the payout', async () => {
    const b = await paidBooking();
    fake.addDashboardRefund(b.pi, b.charge, 6000);
    await refund.handleChargeRefunded(fake.chargeRefundedEvent(b.charge, b.pi, 6000));
    const row = await bookingRow(b.id);
    expect(row.paymentStatus).toBe('REFUNDED');
    expect(row.transferStatus).toBe('REFUNDED');
    expect((await transfer.releaseBookingFunds(b.id)).status).toBe('SKIPPED');
    expect(fake.transfersById.size).toBe(0);
  });

  // ─── 10 ─────────────────────────────────────────────────────
  // The backfill rehearsal runs as scripts/b4-migration-rehearsal.ts on a
  // scratch database (production-shaped legacy rows, migrate deploy, counts,
  // then the backfill again for idempotence); its output rides the gate.

  // ─── 11 ─────────────────────────────────────────────────────

  it('11. queue: each fixture state is listed with its action, and the action works with the fake', async () => {
    // REFUND_UNKNOWN → reconcile.
    const u = await paidBooking();
    fake.script('refunds.create', 'lost', 'lost');
    await refund.refundBooking(u.id, 10, 'unknown');
    // TRANSFER_FAILED → release now.
    const f = await paidBooking();
    fake.script('transfers.create', 'definitive');
    await transfer.releaseBookingFunds(f.id);
    // TRANSFER_PAUSED_SHORTFALL → clear shortfall.
    const s = await paidBooking({ transferStatus: 'PAUSED', extra: { amountShortfallPence: 300 } });
    // COMPLETED_NO_RELEASE_CLOCK → set the clock.
    const c = await paidBooking({ extra: { releaseDueAt: null } });
    // TOPUP_WITHOUT_ASSIGNMENT → refund the top-up.
    const t = await paidBooking({ topups: [{ pence: 1500, flagged: true }] });
    // REFUND_FAILED → retry remainder.
    const rf = await paidBooking();
    fake.script('refunds.create', 'definitive');
    await refund.refundBooking(rf.id, 10, 'refused');

    const rows = await abnormal.listAbnormalStates();
    const find = (state: string, bookingId: string) =>
      rows.find((r) => r.state === state && r.bookingId === bookingId);
    const cases: [string, string, string][] = [
      ['REFUND_UNKNOWN', u.id, 'RECONCILE_REFUND_SLICE'],
      ['TRANSFER_FAILED', f.id, 'RELEASE_NOW'],
      ['TRANSFER_PAUSED_SHORTFALL', s.id, 'CLEAR_SHORTFALL'],
      ['COMPLETED_NO_RELEASE_CLOCK', c.id, 'SET_RELEASE_CLOCK'],
      ['TOPUP_WITHOUT_ASSIGNMENT', t.id, 'REFUND_TOPUP'],
      ['REFUND_FAILED', rf.id, 'RETRY_REFUND_REMAINDER'],
    ];
    for (const [state, bookingId, action] of cases) {
      const row = find(state, bookingId);
      expect(row, `${state} listed`).toBeTruthy();
      expect(row?.actions).toContain(action);
      expect(row?.ageSeconds).toBeGreaterThanOrEqual(0);
      const result = await actions.runStuckMoneyAction(
        action as never,
        bookingId,
        row?.refId as string,
        ids.admin
      );
      expect(result.ok, `${state}: ${result.message}`).toBe(true);
    }
    const again = await abnormal.listAbnormalStates();
    for (const [state, bookingId] of cases) {
      expect(
        again.find((r) => r.state === state && r.bookingId === bookingId),
        `${state} cleared`
      ).toBeFalsy();
    }
    // The flagged top-up was refunded on its own payment intent only.
    expect(fake.refundsFor(t.topups[0].pi).reduce((x, r) => x + r.amount, 0)).toBe(1500);
    expect(fake.refundsFor(t.pi)).toHaveLength(0);
  });
});
