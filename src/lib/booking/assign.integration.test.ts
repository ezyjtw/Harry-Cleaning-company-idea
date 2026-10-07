import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as CancellationModule from '@/lib/services/cancellation.service';
import type * as CascadeModule from '@/lib/services/cascade.service';
import type * as PaymentModule from '@/lib/services/payment-success.service';
import type * as TopupModule from '@/lib/services/topup.service';

import type * as AssignModule from './assign';
import type * as TransitionModule from './cleaner-transition';

// B3.5 (RENA-033): the concurrency matrix against a real Postgres (register
// rule 7: a concurrency or invariant fix ships with a concurrency test against
// the rig Postgres). Opt-in: runs only when BOOKING_LIFECYCLE_INTEGRATION=1
// and DATABASE_URL point at a migrated database (the rig, or the CI e2e job's
// service container). Synthetic users only (@integration.invalid), created
// and removed by the test; no real person is used; Stripe is never reached.
const enabled = process.env.BOOKING_LIFECYCLE_INTEGRATION === '1' && !!process.env.DATABASE_URL;

const REPS = Number(process.env.BOOKING_LIFECYCLE_REPS || 30);
const EMAILS = {
  a: 'b3-cleaner-a@integration.invalid',
  b: 'b3-cleaner-b@integration.invalid',
  customer: 'b3-customer-a@integration.invalid',
};
const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!enabled)('booking lifecycle concurrency against Postgres (B3)', () => {
  let prisma: typeof PrismaDefault;
  let cascade: typeof CascadeModule;
  let assign: typeof AssignModule;
  let payment: typeof PaymentModule;
  let topup: typeof TopupModule;
  let lifecycle: typeof TransitionModule;
  let cancellation: typeof CancellationModule;
  const ids = { a: '', b: '', customer: '' };
  const startedAt = new Date();
  /** A booking day ten days out (UTC midnight of the London date). */
  const day = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) +
      10 * DAY_MS
  );

  async function wipeBookings(): Promise<void> {
    const userIds = [ids.a, ids.b, ids.customer].filter(Boolean);
    if (!userIds.length) return;
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ cleanerId: { in: userIds } }, { clientId: { in: userIds } }] },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length) {
      await prisma.topupRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.refundRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.backgroundJob.deleteMany({ where: { createdAt: { gte: startedAt } } });
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(EMAILS) } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    ids.a = ids.a || '';
    if (userIds.length) {
      Object.assign(ids, { a: userIds[0] ?? '', b: userIds[1] ?? '', customer: userIds[2] ?? '' });
      const bookings = await prisma.booking.findMany({
        where: { OR: [{ cleanerId: { in: userIds } }, { clientId: { in: userIds } }] },
        select: { id: true },
      });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length) {
        await prisma.topupRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.refundRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.cleanerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }

  async function makeCleaner(email: string, name: string): Promise<string> {
    const user = await prisma.user.create({
      data: { email, name, role: 'CLEANER', passwordHash: 'x', emailVerified: new Date() },
    });
    await prisma.cleanerProfile.create({
      data: {
        userId: user.id,
        verified: true,
        bookingBufferMinutes: 30,
        hourlyRateRegular: 20,
        availabilitySlots: {
          create: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            startTime: '00:00',
            endTime: '23:59',
          })),
        },
      },
    });
    return user.id;
  }

  /** A paid booking on the test day for the customer. */
  async function booking(data: {
    cleanerId: string;
    startTime?: string;
    duration?: number;
    status?: string;
    cascadePhase?: string | null;
    cascadeExpiresAt?: Date | null;
    cascadeBackupExpiresAt?: Date | null;
    backupCleanerIds?: string[];
    paymentStatus?: string;
    date?: Date;
    extra?: Record<string, unknown>;
  }): Promise<string> {
    const row = await prisma.booking.create({
      data: {
        clientId: ids.customer,
        cleanerId: data.cleanerId,
        serviceType: 'regular',
        date: data.date ?? day,
        startTime: data.startTime ?? '10:00',
        duration: data.duration ?? 2,
        totalPrice: 60,
        platformFee: 6,
        cleanerEarnings: 50,
        status: (data.status ?? 'AWAITING_CLEANER') as never,
        cascadePhase: (data.cascadePhase === undefined
          ? 'BACKUP_OFFER'
          : data.cascadePhase) as never,
        cascadeExpiresAt:
          data.cascadeExpiresAt === undefined
            ? new Date(Date.now() + 6 * 60 * 60 * 1000)
            : data.cascadeExpiresAt,
        cascadeBackupExpiresAt: data.cascadeBackupExpiresAt ?? null,
        backupCleanerIds: data.backupCleanerIds ?? [],
        paymentStatus: (data.paymentStatus ?? 'SUCCEEDED') as never,
        addressPostcode: 'E4 7AA',
        addressCity: 'London',
        ...(data.extra ?? {}),
      },
    });
    return row.id;
  }

  /** A random head start (0 to max ms) so both orders of a race occur. */
  const jitter = (max: number) =>
    new Promise((r) => setTimeout(r, Math.floor(Math.random() * max)));
  async function after<T>(maxMs: number, fn: () => Promise<T>): Promise<T> {
    await jitter(maxMs);
    return fn();
  }

  /** Blocking rows for a cleaner on the test day. */
  async function blockingFor(cleanerId: string) {
    const { blocksCleanerSlotWhere } = await import('@/lib/availability/slot-eligibility');
    return prisma.booking.findMany({
      where: { cleanerId, date: day, AND: [blocksCleanerSlotWhere()] },
      select: { id: true, status: true, startTime: true },
    });
  }

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'integration-secret';
    // The Stripe client refuses to load without a key; no tested path calls
    // Stripe, and a placeholder that is not a real key can never reach it.
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_unused';
    prisma = (await import('@/lib/db/prisma')).default;
    cascade = await import('@/lib/services/cascade.service');
    assign = await import('./assign');
    payment = await import('@/lib/services/payment-success.service');
    topup = await import('@/lib/services/topup.service');
    lifecycle = await import('./cleaner-transition');
    cancellation = await import('@/lib/services/cancellation.service');
    await cleanup();
    ids.a = await makeCleaner(EMAILS.a, 'Integration Cleaner A');
    ids.b = await makeCleaner(EMAILS.b, 'Integration Cleaner B');
    const customer = await prisma.user.create({
      data: {
        email: EMAILS.customer,
        name: 'Integration Customer',
        role: 'CLIENT',
        passwordHash: 'x',
        emailVerified: new Date(),
      },
    });
    ids.customer = customer.id;
  }, 60_000);

  beforeEach(async () => {
    await wipeBookings();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  }, 60_000);

  it(`1. two overlapping offers to one cleaner accepted at once: exactly one wins (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const x = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '10:00' });
      const y = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '11:00' });
      const [rx, ry] = await Promise.all([
        cascade.atomicAccept(x, ids.a),
        cascade.atomicAccept(y, ids.a),
      ]);
      const wins = [rx, ry].filter((r) => r.success);
      expect(wins).toHaveLength(1);
      const loser = [rx, ry].find((r) => !r.success);
      expect(loser?.code).toBe('SLOT_TAKEN');
      const accepted = await prisma.booking.count({
        where: { id: { in: [x, y] }, status: 'ACCEPTED' },
      });
      expect(accepted).toBe(1);
      expect(
        await prisma.booking.count({ where: { id: { in: [x, y] }, status: 'AWAITING_CLEANER' } })
      ).toBe(1);
    }
  }, 300_000);

  it(`2. two cleaners accepting the same COMBINED_OFFER at once: one wins, the loser is STATE_CHANGED (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const x = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'COMBINED_OFFER',
      });
      const results = await Promise.all([
        cascade.atomicAccept(x, ids.a),
        cascade.atomicAccept(x, ids.b),
      ]);
      expect(results.filter((r) => r.success)).toHaveLength(1);
      expect(results.find((r) => !r.success)?.code).toBe('STATE_CHANGED');
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      expect(row.status).toBe('ACCEPTED');
    }
  }, 300_000);

  it('3. non-overlapping offers (B starts after A ends plus the buffer): both accepted', async () => {
    const x = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '09:00' });
    // 09:00 + 2h = 11:00, + 30 min buffer = 11:30.
    const y = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '11:30' });
    const [rx, ry] = await Promise.all([
      cascade.atomicAccept(x, ids.a),
      cascade.atomicAccept(y, ids.a),
    ]);
    expect(rx.success && ry.success).toBe(true);
  });

  it('3b. inside the buffer is an overlap (11:29 after a job ending 11:00)', async () => {
    const x = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '09:00' });
    const y = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a], startTime: '11:29' });
    expect((await cascade.atomicAccept(x, ids.a)).success).toBe(true);
    expect((await cascade.atomicAccept(y, ids.a)).code).toBe('SLOT_TAKEN');
  });

  it('3d. the single buffer boundary: a job ending 12:00 with a 30 minute buffer blocks 12:29 and allows 12:30', async () => {
    await booking({
      cleanerId: ids.a,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: '10:00',
      duration: 2,
    });
    const blocked = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      startTime: '12:29',
      duration: 1,
    });
    const allowed = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      startTime: '12:30',
      duration: 1,
    });
    expect((await cascade.atomicAccept(blocked, ids.a)).code).toBe('SLOT_TAKEN');
    expect((await cascade.atomicAccept(allowed, ids.a)).success).toBe(true);
  });

  it('3c. a job crossing midnight blocks the next London day (I1 across days)', async () => {
    const next = new Date(day.getTime() + DAY_MS);
    // A's own 23:00 three-hour job (admin-placed, past the template's day
    // end) runs to 02:00 London the next day; the timesheet engine reads one
    // day at a time, so only the instant I1 read can see it.
    await booking({
      cleanerId: ids.a,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: '23:00',
      duration: 3,
    });
    const y = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      startTime: '01:00',
      date: next,
    });
    expect((await cascade.atomicAccept(y, ids.a)).code).toBe('SLOT_TAKEN');
    const z = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      startTime: '03:00',
      date: next,
    });
    expect((await cascade.atomicAccept(z, ids.a)).success).toBe(true);
  });

  it('4. expiry: one second past is refused and the row is unchanged; unexpired and null accept', async () => {
    const past = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      cascadeExpiresAt: new Date(Date.now() - 1000),
    });
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: past } });
    const r1 = await cascade.atomicAccept(past, ids.a);
    expect(r1.success).toBe(false);
    expect(r1.code).toBe('OFFER_EXPIRED');
    expect(r1.reason).toBe('This offer has expired.');
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: past } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(after.status).toBe('AWAITING_CLEANER');

    await wipeBookings();
    const soon = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      cascadeExpiresAt: new Date(Date.now() + 5000),
    });
    expect((await cascade.atomicAccept(soon, ids.a)).success).toBe(true);

    await wipeBookings();
    const open = await booking({
      cleanerId: ids.b,
      backupCleanerIds: [ids.a],
      cascadeExpiresAt: null,
    });
    expect((await cascade.atomicAccept(open, ids.a)).success).toBe(true);
  });

  it(`5. the expiry sweep racing an accept: exactly one outcome, never both (${REPS} reps)`, async () => {
    const outcomes = { accepted: 0, advanced: 0 };
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const expiresAt = new Date(Date.now() + 150);
      const x = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PRIMARY_OFFER',
        cascadeExpiresAt: expiresAt,
        cascadeBackupExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
      // Land on either side of the expiry instant.
      await new Promise((r) => setTimeout(r, Math.max(0, expiresAt.getTime() - Date.now() - 20)));
      const [acc] = await Promise.all([
        after(40, () => cascade.atomicAccept(x, ids.a)),
        after(40, () => cascade.processExpiredCascadeWindows()),
      ]);
      // A refused accept with a sweep that ran just before the expiry leaves
      // the phase for the next tick: run it, then the outcome must be final.
      if (!acc.success) await cascade.processExpiredCascadeWindows();
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      if (acc.success) {
        expect(row.status).toBe('ACCEPTED');
        expect(row.cleanerId).toBe(ids.a);
        outcomes.accepted++;
      } else {
        // Refused as expired, as changed, or by the phase pre-check once the
        // sweep had moved it: all refusals, never an assignment.
        expect(acc.reason).toBeTruthy();
        expect(row.status).toBe('AWAITING_CLEANER');
        expect(row.cascadePhase).toBe('BACKUP_OFFER');
        outcomes.advanced++;
      }
    }
    expect(outcomes.accepted + outcomes.advanced).toBe(REPS);
    // eslint-disable-next-line no-console
    console.log(`[B3 matrix 5] accepted ${outcomes.accepted}, advanced ${outcomes.advanced}`);
  }, 300_000);

  it(`6. payment success for cleaner A racing A accepting an overlapping offer (${REPS} reps)`, async () => {
    const outcomes = { paidKept: 0, paidLost: 0 };
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const pi = `pi_b3_${i}_${Date.now()}`;
      const paid = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        status: 'PENDING',
        cascadePhase: null,
        cascadeExpiresAt: null,
        paymentStatus: 'PENDING',
        startTime: '10:00',
        extra: { stripePaymentIntentId: pi },
      });
      const other = await booking({
        cleanerId: ids.b,
        backupCleanerIds: [ids.a],
        startTime: '11:00',
      });
      await Promise.all([
        after(25, () =>
          payment.processPaymentSuccess({
            bookingId: paid,
            pi: {
              id: pi,
              currency: 'gbp',
              amountReceived: 6000,
              created: Math.floor(Date.now() / 1000),
              chargeId: null,
            },
          } as never)
        ),
        after(25, () => cascade.atomicAccept(other, ids.a)),
      ]);
      const blocking = await blockingFor(ids.a);
      expect(blocking.length).toBeLessThanOrEqual(1);
      const p = await prisma.booking.findUniqueOrThrow({ where: { id: paid } });
      expect(p.status).not.toBe('PENDING');
      expect(p.paymentStatus).toBe('SUCCEEDED');
      if (p.cascadePhase === 'PRIMARY_OFFER') {
        outcomes.paidKept++;
      } else {
        expect(p.cascadePhase).toBe('BACKUP_OFFER');
        expect(p.declinedCleanerIds).toContain(ids.a);
        outcomes.paidLost++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[B3 matrix 6] paid kept the slot ${outcomes.paidKept}, lost it ${outcomes.paidLost}`
    );
  }, 300_000);

  // Design case 7 as written (customer cancel racing COMPLETED from
  // IN_PROGRESS) cannot occur: CANCELLABLE_STATUS excludes EN_ROUTE and
  // IN_PROGRESS, so the cancel is refused before any write (7b proves it).
  // The live race is the cancel against the cleaner's first move, from
  // ACCEPTED (7a): the two CAS writes must exclude each other.
  it(`7a. a customer cancel racing the cleaner's On my way from ACCEPTED (${Math.max(REPS, 50)} reps)`, async () => {
    const reps = Math.max(REPS, 50);
    const outcomes = { enRoute: 0, cancelled: 0 };
    const { bookingStartUtc } = await import('@/lib/time/booking-time');
    const now = new Date((bookingStartUtc(day, '10:00') as Date).getTime() - 60 * 60 * 1000);
    for (let i = 0; i < reps; i++) {
      await wipeBookings();
      const x = await booking({
        cleanerId: ids.a,
        status: 'ACCEPTED',
        cascadePhase: null,
        cascadeExpiresAt: null,
        extra: { acceptedAt: new Date() },
      });
      const [cancelRes, moveRes] = await Promise.all([
        after(15, () =>
          cancellation.executeCancellation({
            bookingId: x,
            cancelledBy: 'client',
            reason: 'integration race',
            refund: { kind: 'amount', amount: 0 },
          })
        ),
        after(15, () =>
          lifecycle.applyCleanerTransition({ bookingId: x, cleanerId: ids.a, to: 'EN_ROUTE', now })
        ),
      ]);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      expect(['EN_ROUTE', 'CANCELLED']).toContain(row.status);
      const onTheWay = await prisma.notification.count({
        where: { userId: ids.customer, title: 'Cleaner on the way' },
      });
      if (row.status === 'EN_ROUTE') {
        outcomes.enRoute++;
        expect(moveRes.status).toBe(200);
        expect(cancelRes.ok).toBe(false);
        expect(row.cancelledAt).toBeNull();
        expect(onTheWay).toBe(1);
      } else {
        outcomes.cancelled++;
        expect(cancelRes.ok).toBe(true);
        // 409 when the CAS lost; 400 when the move read the row after the
        // cancel had committed (CANCELLED has no transitions). Never 200.
        expect([400, 409]).toContain(moveRes.status);
        expect(row.arrivalConfirmed).toBe(false);
        expect(onTheWay).toBe(0);
      }
      expect(await prisma.refundRecord.count({ where: { bookingId: x } })).toBe(0);
    }
    // eslint-disable-next-line no-console
    console.log(`[B3 matrix 7a] en route ${outcomes.enRoute}, cancelled ${outcomes.cancelled}`);
  }, 600_000);

  it('7b. from IN_PROGRESS a customer cancel is refused and completion lands once', async () => {
    const nowDay = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    );
    await prisma.cleanerProfile.update({ where: { userId: ids.a }, data: { completedJobs: 0 } });
    const x = await booking({
      cleanerId: ids.a,
      status: 'IN_PROGRESS',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: 'Flexible',
      date: nowDay,
      extra: { checkedInAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    const [cancelRes, completeRes] = await Promise.all([
      cancellation.executeCancellation({
        bookingId: x,
        cancelledBy: 'client',
        refund: { kind: 'amount', amount: 0 },
      }),
      lifecycle.applyCleanerTransition({ bookingId: x, cleanerId: ids.a, to: 'COMPLETED' }),
    ]);
    expect(cancelRes.ok).toBe(false);
    expect(cancelRes.status).toBe(422);
    expect(completeRes.status).toBe(200);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.status).toBe('COMPLETED');
    expect(row.completedAt).not.toBeNull();
    expect(row.cancelledAt).toBeNull();
    expect(row.releaseDueAt).not.toBeNull();
    expect(
      (await prisma.cleanerProfile.findUniqueOrThrow({ where: { userId: ids.a } })).completedJobs
    ).toBe(1);
  });

  it(`8. double tap COMPLETED: one 200, one 409, one audit row, completedJobs plus one (${REPS} reps)`, async () => {
    const nowDay = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    );
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      await prisma.cleanerProfile.update({ where: { userId: ids.a }, data: { completedJobs: 0 } });
      const x = await booking({
        cleanerId: ids.a,
        status: 'IN_PROGRESS',
        cascadePhase: null,
        cascadeExpiresAt: null,
        startTime: 'Flexible',
        date: nowDay,
        extra: { checkedInAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });
      const results = await Promise.all([
        lifecycle.applyCleanerTransition({ bookingId: x, cleanerId: ids.a, to: 'COMPLETED' }),
        lifecycle.applyCleanerTransition({ bookingId: x, cleanerId: ids.a, to: 'COMPLETED' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({ where: { entityId: x, action: 'BOOKING_COMPLETED' } })
      ).toBe(1);
      const profile = await prisma.cleanerProfile.findUniqueOrThrow({ where: { userId: ids.a } });
      expect(profile.completedJobs).toBe(1);
    }
  }, 300_000);

  it(`9. a decline racing the expiry sweep: declined once, the phase advances once (${REPS} reps)`, async () => {
    const outcomes9 = { declined: 0, refused: 0 };
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const expiresAt = new Date(Date.now() + 150);
      const x = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PRIMARY_OFFER',
        cascadeExpiresAt: expiresAt,
        cascadeBackupExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
      await new Promise((r) => setTimeout(r, Math.max(0, expiresAt.getTime() - Date.now() - 20)));
      const [declined] = await Promise.all([
        after(40, () => cascade.handleDecline(x, ids.a)),
        after(40, () => cascade.processExpiredCascadeWindows()),
      ]);
      if (declined.success) outcomes9.declined++;
      else outcomes9.refused++;
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      expect(row.declinedCleanerIds.filter((c) => c === ids.a).length).toBeLessThanOrEqual(1);
      expect(row.cascadePhase).toBe('BACKUP_OFFER');
      const offers = await prisma.notification.count({
        where: { userId: ids.b, type: 'BOOKING_REQUEST', data: { path: ['bookingId'], equals: x } },
      });
      expect(offers).toBe(1);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[B3 matrix 9] decline recorded ${outcomes9.declined}, refused as stale ${outcomes9.refused}`
    );
  }, 300_000);

  it('10. the provisional finalise against a slot taken meanwhile: top-up recorded and flagged, booking stays provisional', async () => {
    const pi = `pi_b3_topup_${Date.now()}`;
    const x = await booking({
      cleanerId: ids.a,
      backupCleanerIds: [ids.b],
      cascadePhase: 'PROVISIONAL_APPROVAL',
      cascadeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      extra: {
        provisionalCleanerId: ids.b,
        provisionalPrice: 70,
        topupAmount: 10,
        topupApproved: true,
        approvalExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        provisionalSource: 'CASCADE',
      },
    });
    // Cleaner B took an overlapping job while the customer was approving.
    await booking({
      cleanerId: ids.b,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: '11:00',
    });
    const record = await prisma.topupRecord.create({
      data: {
        bookingId: x,
        amount: 10,
        reason: 'integration',
        stripePaymentIntentId: pi,
        paymentMethodType: 'on_session',
      },
    });
    await topup.handleTopupPiSucceeded(pi, x);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.status).toBe('AWAITING_CLEANER');
    expect(row.cascadePhase).toBe('PROVISIONAL_APPROVAL');
    expect(row.cleanerId).toBe(ids.a);
    const rec = await prisma.topupRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(rec.status).toBe('SUCCEEDED');
    expect(rec.failureReason).toBe('TOPUP_WITHOUT_ASSIGNMENT: SLOT_TAKEN');
    expect(
      await prisma.auditLog.count({ where: { entityId: x, action: 'TOPUP_WITHOUT_ASSIGNMENT' } })
    ).toBe(1);
  });

  it('10b. the provisional finalise with the slot free assigns and records the top-up in one transaction', async () => {
    const pi = `pi_b3_topup_ok_${Date.now()}`;
    const x = await booking({
      cleanerId: ids.a,
      backupCleanerIds: [ids.b],
      cascadePhase: 'PROVISIONAL_APPROVAL',
      extra: {
        provisionalCleanerId: ids.b,
        provisionalPrice: 70,
        topupAmount: 10,
        topupApproved: true,
        approvalExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        provisionalSource: 'CASCADE',
      },
    });
    const record = await prisma.topupRecord.create({
      data: {
        bookingId: x,
        amount: 10,
        reason: 'integration',
        stripePaymentIntentId: pi,
        paymentMethodType: 'on_session',
      },
    });
    await topup.handleTopupPiSucceeded(pi, x);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.status).toBe('ACCEPTED');
    expect(row.cleanerId).toBe(ids.b);
    const rec = await prisma.topupRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(rec.status).toBe('SUCCEEDED');
    expect(rec.failureReason).toBeNull();
  });

  it(`10c. a flagged top-up raises the captured total exactly once, even with both writers racing (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      await wipeBookings();
      const pi = `pi_b3_topup_race_${Date.now()}_${i}`;
      const x = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PROVISIONAL_APPROVAL',
        cascadeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        extra: {
          provisionalCleanerId: ids.b,
          provisionalPrice: 70,
          topupAmount: 10,
          topupApproved: true,
          approvalExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          provisionalSource: 'CASCADE',
        },
      });
      await booking({
        cleanerId: ids.b,
        status: 'ACCEPTED',
        cascadePhase: null,
        cascadeExpiresAt: null,
        startTime: '11:00',
      });
      await prisma.topupRecord.create({
        data: {
          bookingId: x,
          amount: 10,
          reason: 'integration',
          stripePaymentIntentId: pi,
          paymentMethodType: 'on_session',
        },
      });
      // The direct path and the webhook both land on the same charge.
      await Promise.all([
        topup.handleTopupPiSucceeded(pi, x),
        after(20, () => topup.handleTopupPiSucceeded(pi, x)),
      ]);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: x },
        include: { topupRecords: { where: { status: 'SUCCEEDED' } } },
      });
      // refundBooking's ceiling (totalAmountCharged) must equal what its LIFO
      // allocation counts: the original 60 plus every SUCCEEDED top-up PI.
      const stack = 60 + row.topupRecords.reduce((sum, t) => sum + Number(t.amount), 0);
      expect(Number(row.totalAmountCharged)).toBe(70);
      expect(Number(row.totalAmountCharged)).toBe(stack);
      expect(
        await prisma.auditLog.count({ where: { entityId: x, action: 'TOPUP_WITHOUT_ASSIGNMENT' } })
      ).toBe(1);
    }
  }, 300_000);

  it('10d. a flagged top-up never moves the cleaner side (R2 boundary)', async () => {
    const pi = `pi_b3_topup_boundary_${Date.now()}`;
    const x = await booking({
      cleanerId: ids.a,
      backupCleanerIds: [ids.b],
      cascadePhase: 'PROVISIONAL_APPROVAL',
      cascadeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      extra: {
        provisionalCleanerId: ids.b,
        provisionalPrice: 70,
        topupAmount: 10,
        topupApproved: true,
        approvalExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        provisionalSource: 'CASCADE',
      },
    });
    await booking({
      cleanerId: ids.b,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: '11:00',
    });
    await prisma.topupRecord.create({
      data: {
        bookingId: x,
        amount: 10,
        reason: 'integration',
        stripePaymentIntentId: pi,
        paymentMethodType: 'on_session',
      },
    });
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    await topup.handleTopupPiSucceeded(pi, x);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    // Captured, charged and refundable money rose; nothing cleaner-side moved.
    expect(Number(after.totalAmountCharged)).toBe(70);
    expect(Number(after.cleanerEarnings)).toBe(Number(before.cleanerEarnings));
    expect(after.cleanerPayoutAmount).toEqual(before.cleanerPayoutAmount);
    expect(after.transferStatus).toBe(before.transferStatus);
    expect(after.releaseDueAt).toEqual(before.releaseDueAt);
    // The cleaner's share of a refund reads the total net of the flag, so it
    // is exactly the pre-flag figure (50 of 60 for a 60 refund, not 50 of 70).
    // B4: the share is the ledger's one formula (cleanerShareForAmountPence).
    const { cleanerShareForAmountPence } = await import('@/lib/services/refund.service');
    const { flaggedTopupPounds } = await import('@/lib/services/topup-flag');
    expect(await flaggedTopupPounds(x)).toBe(10);
    expect(await cleanerShareForAmountPence(x, 6000)).toBe(5000);
  });

  it("11. a reschedule accept after an admin reassign is refused; the new cleaner's row stays put", async () => {
    const { resolveRescheduleOffer } = await import('@/lib/services/reschedule-offer.service');
    const x = await booking({
      cleanerId: ids.a,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: '10:00',
    });
    const offer = await prisma.rescheduleOffer.create({
      data: {
        bookingId: x,
        cleanerId: ids.a,
        proposedDate: day,
        proposedTime: '15:00',
        originalDate: day,
        originalTime: '10:00',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // Admin moves the job to B before the customer answers.
    await prisma.booking.update({ where: { id: x }, data: { cleanerId: ids.b } });
    const res = await resolveRescheduleOffer({ offerId: offer.id, action: 'accept' });
    expect(res.ok).toBe(false);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.cleanerId).toBe(ids.b);
    expect(row.startTime).toBe('10:00');
  });

  it('12. a transition read on the old slot is refused once the booking has moved', async () => {
    const { transitionBooking } = await import('./transition');
    const nowDay = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    );
    const x = await booking({
      cleanerId: ids.a,
      status: 'ACCEPTED',
      cascadePhase: null,
      cascadeExpiresAt: null,
      startTime: 'Flexible',
      date: nowDay,
    });
    const stale = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    // A reschedule lands between the read and the write.
    await prisma.booking.update({ where: { id: x }, data: { date: day, startTime: '10:00' } });
    const res = await transitionBooking({
      booking: stale,
      cleanerId: ids.a,
      to: 'EN_ROUTE',
      now: new Date(
        Date.UTC(nowDay.getUTCFullYear(), nowDay.getUTCMonth(), nowDay.getUTCDate(), 12)
      ),
      actor: { kind: 'CLEANER', id: ids.a },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('STATE_CHANGED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: x } })).status).toBe('ACCEPTED');
  });

  describe('admin revert (R1, James-ruled at the B3 gate)', () => {
    const ADMIN_EMAIL = 'b3-admin@integration.invalid';
    let adminId = '';

    beforeAll(async () => {
      const admin = await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: { role: 'ADMIN' },
        create: { email: ADMIN_EMAIL, name: 'Integration Admin', role: 'ADMIN', passwordHash: 'x' },
      });
      adminId = admin.id;
    });

    afterAll(async () => {
      await prisma.notification.deleteMany({ where: { userId: adminId } });
      await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
    });

    async function provisionalReassign(): Promise<string> {
      return booking({
        cleanerId: ids.a,
        cascadePhase: 'PROVISIONAL_APPROVAL',
        cascadeExpiresAt: new Date(Date.now() - 60 * 1000),
        startTime: '10:00',
        extra: {
          provisionalCleanerId: ids.b,
          provisionalPrice: 70,
          topupAmount: 10,
          approvalExpiresAt: new Date(Date.now() - 60 * 1000),
          provisionalSource: 'ADMIN_REASSIGN',
          reassignPreviousStatus: 'ACCEPTED',
          reassignPreviousCleanerId: ids.a,
        },
      });
    }

    it('13. a lost slot refuses the revert: state kept, no double booking, one audit row and one alert across two sweeps', async () => {
      const x = await provisionalReassign();
      // The original cleaner took an overlapping job during the approval window.
      const taken = await booking({
        cleanerId: ids.a,
        status: 'ACCEPTED',
        cascadePhase: null,
        cascadeExpiresAt: null,
        startTime: '11:00',
      });
      expect(await cascade.expireProvisionalApproval(x)).toBe(false);
      expect(await cascade.expireProvisionalApproval(x)).toBe(false);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      expect(row.status).toBe('AWAITING_CLEANER');
      expect(row.cascadePhase).toBe('PROVISIONAL_APPROVAL');
      expect(row.reassignPreviousCleanerId).toBe(ids.a);
      const blocking = await blockingFor(ids.a);
      expect(blocking.map((b) => b.id)).toEqual([taken]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: x, action: 'ADMIN_REASSIGN_REVERT_REFUSED' },
        })
      ).toBe(1);
      expect(
        await prisma.notification.count({
          where: { userId: adminId, data: { path: ['bookingId'], equals: x } },
        })
      ).toBe(1);
      // The customer hears nothing false: no "window closed, nothing charged" bell.
      expect(await prisma.notification.count({ where: { userId: ids.customer } })).toBe(0);
    });

    it('13b. with the slot still free the revert lands as before', async () => {
      const x = await provisionalReassign();
      expect(await cascade.expireProvisionalApproval(x)).toBe(true);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
      expect(row.status).toBe('ACCEPTED');
      expect(row.cleanerId).toBe(ids.a);
      expect(row.cascadePhase).toBeNull();
    });
  });

  it('14. reserve promotion writes a new explicit expiry (cascadeExpiresAt and approvalExpiresAt)', async () => {
    const stale = new Date(Date.now() - 60 * 1000);
    const x = await booking({
      cleanerId: ids.a,
      cascadePhase: 'PHASE2_RESERVE',
      cascadeExpiresAt: stale,
      extra: { reserveCleanerIds: [ids.b], phase2Entered: true },
    });
    expect(await cascade.promoteReserves(x)).toBe(true);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.cascadePhase).toBe('PROVISIONAL_APPROVAL');
    expect(row.provisionalCleanerId).toBe(ids.b);
    expect(row.approvalExpiresAt).not.toBeNull();
    expect(row.cascadeExpiresAt?.getTime()).toBe(row.approvalExpiresAt?.getTime());
    expect(row.cascadeExpiresAt?.getTime() ?? 0).toBeGreaterThan(Date.now());
  });

  it('15. a lock wait that spends the transaction budget is CleanerBusyError; nothing is written', async () => {
    const x = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a] });
    const key = `cleaner:${ids.a}`;
    // A holder outside the helper keeps A's lock past the helper's 20s budget.
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        await new Promise((r) => setTimeout(r, 22_000));
      },
      { maxWait: 5_000, timeout: 40_000 }
    );
    await new Promise((r) => setTimeout(r, 300));
    const err = await cascade.atomicAccept(x, ids.a).then(
      () => null,
      (e: unknown) => e
    );
    await holder;
    expect(err).toBeInstanceOf(assign.CleanerBusyError);
    const { busyResponse } = await import('@/lib/http/busy');
    const res = busyResponse(err);
    expect(res?.status).toBe(503);
    expect(res?.headers.get('Retry-After')).toBe('5');
    expect(await res?.json()).toEqual({ error: 'BUSY', message: expect.any(String) });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
    expect(row.status).toBe('AWAITING_CLEANER');
    expect(row.cleanerId).toBe(ids.b);
  }, 60_000);

  describe('deletion blockers (RENA-034, James-ruled)', () => {
    async function blockersFor(userId: string) {
      const { GdprService } = await import('@/lib/services/gdpr.service');
      return GdprService.getCleanerDeletionBlockers(userId);
    }

    it('backup, reserve and unaccepted primary offers do not block', async () => {
      await booking({ cleanerId: ids.a, backupCleanerIds: [ids.b], cascadePhase: 'PRIMARY_OFFER' });
      await booking({ cleanerId: ids.a, backupCleanerIds: [ids.b], startTime: '14:00' });
      await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PHASE2_RESERVE',
        startTime: '16:00',
        extra: { reserveCleanerIds: [ids.b] },
      });
      expect(await blockersFor(ids.b)).toEqual([]);
      expect(await blockersFor(ids.a)).toEqual([]);
    });

    it('a provisional assignment blocks', async () => {
      await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PROVISIONAL_APPROVAL',
        extra: { provisionalCleanerId: ids.b, provisionalSource: 'CASCADE' },
      });
      const b = await blockersFor(ids.b);
      expect(b).toHaveLength(1);
      expect(b[0]).toContain('approves a price change');
    });

    it('a live accepted job and a pending payout block, with their named text', async () => {
      await booking({
        cleanerId: ids.b,
        status: 'ACCEPTED',
        cascadePhase: null,
        cascadeExpiresAt: null,
      });
      await booking({
        cleanerId: ids.b,
        status: 'COMPLETED',
        cascadePhase: null,
        cascadeExpiresAt: null,
        startTime: '15:00',
        extra: { transferStatus: 'PENDING' },
      });
      const b = await blockersFor(ids.b);
      expect(b.some((x) => x.includes('upcoming or in-progress booking'))).toBe(true);
      expect(b.some((x) => x.includes('payout still in flight'))).toBe(true);
    });

    it('a deactivated cleaner is skipped by the cascade and their live offers move on', async () => {
      const x = await booking({
        cleanerId: ids.a,
        backupCleanerIds: [ids.b],
        cascadePhase: 'PRIMARY_OFFER',
        cascadeBackupExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
      await prisma.user.update({ where: { id: ids.a }, data: { accountStatus: 'DEACTIVATED' } });
      try {
        const { filterSlotAvailableCleaners } = await import('@/lib/availability/slot-eligibility');
        const free = await filterSlotAvailableCleaners([ids.a, ids.b], {
          date: day,
          startTime: '18:00',
          durationHours: 1,
        });
        expect(free.has(ids.a)).toBe(false);
        expect(free.has(ids.b)).toBe(true);
        expect(await cascade.releaseOffersForDeletedCleaner(ids.a)).toBe(1);
        const row = await prisma.booking.findUniqueOrThrow({ where: { id: x } });
        expect(row.cascadePhase).toBe('BACKUP_OFFER');
        expect(row.declinedCleanerIds).toContain(ids.a);
      } finally {
        await prisma.user.update({ where: { id: ids.a }, data: { accountStatus: 'ACTIVE' } });
      }
    });
  });

  it('the lock serialises: a helper write for one cleaner waits for another holding the lock', async () => {
    const x = await booking({ cleanerId: ids.b, backupCleanerIds: [ids.a] });
    let released = false;
    const holder = assign.withCleanerLock(ids.a, async () => {
      await new Promise((r) => setTimeout(r, 400));
      released = true;
    });
    await new Promise((r) => setTimeout(r, 50));
    const accept = cascade.atomicAccept(x, ids.a).then((r) => ({ r, releasedFirst: released }));
    await holder;
    const { r, releasedFirst } = await accept;
    expect(r.success).toBe(true);
    expect(releasedFirst).toBe(true);
  });
});
