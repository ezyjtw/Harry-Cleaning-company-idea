import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as JobsModule from '@/lib/retention/jobs';
import type * as ComplianceModule from '@/lib/services/compliance-scheduler.service';
import type * as LeaseModule from '@/lib/services/scheduler-lease.service';
import type * as SchedulerModule from '@/lib/services/scheduler.service';

import { ARMED, DRY_RUN, RETENTION_MODE_KEY } from './arming';
import { MESSAGE_REDACTED } from './matrix';

// B7.3 (RENA-063): the retention matrix against a real Postgres. Opt-in:
// RETENTION_INTEGRATION=1 and DATABASE_URL at a migrated database. Synthetic
// users (@integration.invalid) only. The auditor's four questions each have
// a named case below: the legal holds, the six, two and seven year anchors,
// thread-level message anonymisation, and that a failed compliance job never
// writes the day's success marker.
const enabled = process.env.RETENTION_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const DAY_MS = 24 * 60 * 60 * 1000;
const TAG = 'b7r';
const NOW = new Date('2026-11-06T12:00:00Z');
const yearsAgo = (years: number, plusDays = 0) => {
  const d = new Date(NOW);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return new Date(d.getTime() - plusDays * DAY_MS);
};

describe.skipIf(!enabled)('retention matrix against Postgres (B7.3)', () => {
  let prisma: typeof PrismaDefault;
  let jobs: typeof JobsModule;
  let scheduler: typeof SchedulerModule;
  let compliance: typeof ComplianceModule;
  let lease: typeof LeaseModule;

  async function wipe() {
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${TAG}.integration.invalid` } } });
    await prisma.user.deleteMany({
      where: {
        email: { startsWith: 'deleted+' },
        name: 'Deleted user',
        retentionTombstonedAt: { not: null },
        bookingsAsClient: { none: {} },
        bookingsAsCleaner: { none: {} },
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityType: `${TAG}-audit` } });
    await prisma.gdprConsent.deleteMany({
      where: { email: { endsWith: `@${TAG}.integration.invalid` } },
    });
    await prisma.dataRetentionLog.deleteMany({
      where: { reason: 'retention_policy', entityId: 'batch' },
    });
  }

  beforeAll(async () => {
    prisma = (await import('@/lib/db/prisma')).default;
    jobs = await import('@/lib/retention/jobs');
    scheduler = await import('@/lib/services/scheduler.service');
    compliance = await import('@/lib/services/compliance-scheduler.service');
    lease = await import('@/lib/services/scheduler-lease.service');
    await wipe();
  });
  beforeEach(wipe);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  let seq = 0;
  async function user(role: 'CLIENT' | 'CLEANER', data: Record<string, unknown> = {}) {
    seq += 1;
    return prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${seq}-${Date.now()}@${TAG}.integration.invalid`,
        name: `Fixture ${seq}`,
        phone: '07000000000',
        role,
        ...data,
      } as never,
    });
  }
  async function closedUser(deletedAt: Date, data: Record<string, unknown> = {}) {
    const u = await user('CLIENT', {
      isDeleted: true,
      deletedAt,
      accountStatus: 'DEACTIVATED',
      ...data,
    });
    await prisma.address.create({
      data: {
        userId: u.id,
        label: 'Home',
        line1: '1 Fixture Row',
        city: 'London',
        postcode: 'E4 7AA',
      },
    });
    return u;
  }
  async function booking(
    clientId: string,
    cleanerId: string,
    date: Date,
    extra: Record<string, unknown> = {}
  ) {
    return prisma.booking.create({
      data: {
        clientId,
        cleanerId,
        serviceType: 'regular',
        date,
        startTime: '10:00',
        duration: 2,
        totalPrice: 60,
        platformFee: 6,
        cleanerEarnings: 50,
        status: 'COMPLETED',
        paymentStatus: 'SUCCEEDED',
        transferStatus: 'RELEASED',
        addressPostcode: 'E4 7AA',
        addressCity: 'London',
        ...extra,
      } as never,
    });
  }

  // ─── The arming gate (B7b delta): UNARMED by default, counts only ────────

  it('unarmed by default: a missing row is created as dry_run; the run counts eligible and held and mutates nothing', async () => {
    await prisma.platformConfig.deleteMany({ where: { key: RETENTION_MODE_KEY } });
    const cleaner = await user('CLEANER');
    const past = await closedUser(yearsAgo(6, 1));
    const held = await closedUser(yearsAgo(6, 1));
    await booking(held.id, cleaner.id, yearsAgo(5));
    const old = await prisma.notification.create({
      data: {
        userId: past.id,
        type: 'BOOKING_CONFIRMED',
        title: 'x',
        body: 'x',
        createdAt: yearsAgo(2, 1),
      },
    });

    const r = await jobs.runAccountDataRetention({ now: NOW });
    expect(r).toMatchObject({ mode: DRY_RUN, eligible: 1, held: 1, affected: 0, batches: 0 });
    const n = await jobs.runNotificationsRetention({ now: NOW });
    expect(n).toMatchObject({ mode: DRY_RUN, eligible: 1, affected: 0 });
    const row = await prisma.platformConfig.findUniqueOrThrow({
      where: { key: RETENTION_MODE_KEY },
    });
    expect(row.value).toBe(DRY_RUN);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: past.id } })).name).not.toBe(
      'Deleted user'
    );
    expect(await prisma.address.count({ where: { userId: past.id } })).toBe(1);
    expect(await prisma.notification.findUnique({ where: { id: old.id } })).not.toBeNull();
    expect(
      await prisma.dataRetentionLog.count({
        where: { entityType: 'accountData', entityId: 'batch' },
      })
    ).toBe(0);
    // Any value other than the exact armed string is a dry run.
    await prisma.platformConfig.update({
      where: { key: RETENTION_MODE_KEY },
      data: { value: 'ARMED' },
    });
    expect((await jobs.runAccountDataRetention({ now: NOW })).mode).toBe(DRY_RUN);
    await prisma.platformConfig.update({
      where: { key: RETENTION_MODE_KEY },
      data: { value: 'armed ' },
    });
    expect((await jobs.runAccountDataRetention({ now: NOW })).mode).toBe(DRY_RUN);
    await prisma.platformConfig.update({
      where: { key: RETENTION_MODE_KEY },
      data: { value: DRY_RUN },
    });
  });

  it('a dry run through the compliance job is a success with mode dry_run, never a failure', async () => {
    await prisma.platformConfig.upsert({
      where: { key: RETENTION_MODE_KEY },
      update: { value: DRY_RUN },
      create: { key: RETENTION_MODE_KEY, value: DRY_RUN },
    });
    const r = await compliance.ComplianceSchedulerService.runRetentionRow(
      'retention_notifications',
      jobs.runNotificationsRetention
    );
    expect(r.success).toBe(true);
    expect(r.details.mode).toBe(DRY_RUN);
    expect(r.details.affected).toBe(0);
  });

  // ─── Account data: six years after closure ─────────────────────────────
  // The mutating cases below run ARMED, set directly on the rig row as the
  // stand-in for James's word; the gate itself is proven above.

  it('account data: tombstoned one day past six years, untouched one day short, and each legal hold keeps the row', async () => {
    const cleaner = await user('CLEANER');
    const past = await closedUser(yearsAgo(6, 1));
    const young = await closedUser(yearsAgo(6, -1));
    const heldDispute = await closedUser(yearsAgo(6, 1));
    const heldComplaint = await closedUser(yearsAgo(6, 1));
    const heldMoney = await closedUser(yearsAgo(6, 1));
    const heldTax = await closedUser(yearsAgo(6, 1));
    const b1 = await booking(heldDispute.id, cleaner.id, yearsAgo(7));
    await prisma.dispute.create({
      data: {
        bookingId: b1.id,
        raisedById: heldDispute.id,
        reason: 'x',
        description: 'x',
        status: 'OPEN',
      },
    });
    const b2 = await booking(heldComplaint.id, cleaner.id, yearsAgo(7));
    await prisma.complaint.create({
      data: {
        bookingId: b2.id,
        filedById: heldComplaint.id,
        category: 'POOR_QUALITY',
        subject: 'x',
        description: 'x',
        status: 'OPEN',
      } as never,
    });
    await booking(heldMoney.id, cleaner.id, yearsAgo(7), { transferStatus: 'PENDING' });
    await booking(heldTax.id, cleaner.id, yearsAgo(5));
    // a settled, old booking on the past user does not hold it
    await booking(past.id, cleaner.id, yearsAgo(7));

    const r = await jobs.runAccountDataRetention({ now: NOW, mode: ARMED });
    expect(r.affected).toBe(1);
    expect(r.held).toBe(4);
    const p = await prisma.user.findUniqueOrThrow({ where: { id: past.id } });
    expect(p.name).toBe('Deleted user');
    expect(p.email).toBe(`deleted+${past.id}@invalid`);
    expect(p.phone).toBeNull();
    expect(p.retentionTombstonedAt).not.toBeNull();
    expect(await prisma.address.count({ where: { userId: past.id } })).toBe(0);
    for (const u of [young, heldDispute, heldComplaint, heldMoney, heldTax]) {
      const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.retentionTombstonedAt, u.id).toBeNull();
      expect(row.name).not.toBe('Deleted user');
      expect(await prisma.address.count({ where: { userId: u.id } })).toBe(1);
    }
    expect((await jobs.runAccountDataRetention({ now: NOW, mode: ARMED })).affected).toBe(0);
    const logs = await prisma.dataRetentionLog.findMany({
      where: { entityType: 'accountData', entityId: 'batch' },
    });
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0].metadata as object).sort()).toEqual(['affected', 'cutoff']);
  });

  // ─── Booking records: six years after the booking date ─────────────────

  it('booking records: anonymised past six years (money kept), untouched one day short, held by an open dispute, an open complaint, or a card dispute in the chargeback window', async () => {
    const c = await user('CLIENT');
    const k = await user('CLEANER');
    const pii = {
      guestName: 'Guest Fixture',
      guestEmail: `guest@${TAG}.integration.invalid`,
      guestPhone: '07000000001',
      addressLine1: '1 Fixture Row',
      notes: 'key under the mat',
      rooms: { bedrooms: 2, kitchen: true, access: 'side gate code 1234' },
    };
    const past = await booking(c.id, k.id, yearsAgo(6, 1), pii);
    const young = await booking(c.id, k.id, yearsAgo(6, -1), pii);
    const hd = await booking(c.id, k.id, yearsAgo(6, 1), pii);
    await prisma.dispute.create({
      data: {
        bookingId: hd.id,
        raisedById: c.id,
        reason: 'x',
        description: 'x',
        status: 'UNDER_REVIEW',
      },
    });
    const hc = await booking(c.id, k.id, yearsAgo(6, 1), pii);
    await prisma.complaint.create({
      data: {
        bookingId: hc.id,
        filedById: c.id,
        category: 'NO_SHOW',
        subject: 'x',
        description: 'x',
        status: 'OPEN',
      } as never,
    });
    const hcb = await booking(c.id, k.id, yearsAgo(6, 1), pii);
    await prisma.dispute.create({
      data: {
        bookingId: hcb.id,
        raisedById: c.id,
        reason: 'x',
        description: 'x',
        status: 'RESOLVED',
        createdAt: new Date(NOW.getTime() - 10 * DAY_MS),
      },
    });

    const r = await jobs.runBookingRecordsRetention({ now: NOW, mode: ARMED });
    expect(r.affected).toBe(1);
    expect(r.held).toBe(3);
    const p = await prisma.booking.findUniqueOrThrow({ where: { id: past.id } });
    expect([p.guestName, p.guestEmail, p.guestPhone, p.addressLine1, p.notes]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(p.rooms).toEqual({ bedrooms: 2, kitchen: true });
    expect(Number(p.totalPrice)).toBe(60);
    expect(p.status).toBe('COMPLETED');
    expect(p.transferStatus).toBe('RELEASED');
    for (const b of [young, hd, hc, hcb]) {
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.guestEmail, b.id).toBe(pii.guestEmail);
    }
    expect((await jobs.runBookingRecordsRetention({ now: NOW, mode: ARMED })).affected).toBe(0);
  });

  // ─── Messages: two years after the thread's last message ───────────────

  it('messages: a whole stale thread is redacted and its reports deleted; a thread with one newer message keeps every message; an open dispute holds the thread', async () => {
    const c = await user('CLIENT');
    const k = await user('CLEANER');
    const stale = await booking(c.id, k.id, yearsAgo(3));
    const live = await booking(c.id, k.id, yearsAgo(3));
    const held = await booking(c.id, k.id, yearsAgo(3));
    const msg = (bookingId: string, from: string, to: string, at: Date) =>
      prisma.message.create({
        data: { bookingId, senderId: from, receiverId: to, content: 'hello there', createdAt: at },
      });
    const s1 = await msg(stale.id, c.id, k.id, yearsAgo(2, 10));
    const s2 = await msg(stale.id, k.id, c.id, yearsAgo(2, 5));
    await prisma.messageReport.create({
      data: {
        messageId: s1.id,
        bookingId: stale.id,
        reporterId: c.id,
        reportedUserId: k.id,
        reason: 'SPAM',
      } as never,
    });
    const l1 = await msg(live.id, c.id, k.id, yearsAgo(2, 10));
    const l2 = await msg(live.id, k.id, c.id, yearsAgo(1));
    const h1 = await msg(held.id, c.id, k.id, yearsAgo(2, 10));
    await prisma.dispute.create({
      data: { bookingId: held.id, raisedById: c.id, reason: 'x', description: 'x', status: 'OPEN' },
    });

    const r = await jobs.runMessagesRetention({ now: NOW, mode: ARMED });
    expect(r.affected).toBe(2);
    expect(r.held).toBe(1);
    for (const id of [s1.id, s2.id]) {
      expect((await prisma.message.findUniqueOrThrow({ where: { id } })).content).toBe(
        MESSAGE_REDACTED
      );
    }
    expect(await prisma.messageReport.count({ where: { messageId: s1.id } })).toBe(0);
    for (const id of [l1.id, l2.id, h1.id]) {
      expect((await prisma.message.findUniqueOrThrow({ where: { id } })).content, id).toBe(
        'hello there'
      );
    }
    expect((await jobs.runMessagesRetention({ now: NOW, mode: ARMED })).affected).toBe(0);
  });

  // ─── Notifications, consent metadata, audit logs ───────────────────────

  it('notifications past two years are deleted, younger ones kept', async () => {
    const c = await user('CLIENT');
    const old = await prisma.notification.create({
      data: {
        userId: c.id,
        type: 'BOOKING_CONFIRMED',
        title: 'x',
        body: 'x',
        createdAt: yearsAgo(2, 1),
      },
    });
    const young = await prisma.notification.create({
      data: {
        userId: c.id,
        type: 'BOOKING_CONFIRMED',
        title: 'x',
        body: 'x',
        createdAt: yearsAgo(2, -1),
      },
    });
    const r = await jobs.runNotificationsRetention({ now: NOW, mode: ARMED });
    expect(r.affected).toBe(1);
    expect(await prisma.notification.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.notification.findUnique({ where: { id: young.id } })).not.toBeNull();
  });

  it('consent metadata: IP and user agent nulled after two years, the decision and date kept; younger rows untouched', async () => {
    const email = `consent@${TAG}.integration.invalid`;
    const old = await prisma.gdprConsent.create({
      data: {
        email,
        consentType: 'marketing',
        granted: true,
        ipAddress: '203.0.113.5',
        userAgent: 'UA',
        createdAt: yearsAgo(2, 1),
      },
    });
    const young = await prisma.gdprConsent.create({
      data: {
        email,
        consentType: 'marketing',
        granted: true,
        ipAddress: '203.0.113.6',
        userAgent: 'UA',
        createdAt: yearsAgo(2, -1),
      },
    });
    const r = await jobs.runConsentMetadataRetention({ now: NOW, mode: ARMED });
    expect(r.affected).toBe(1);
    const o = await prisma.gdprConsent.findUniqueOrThrow({ where: { id: old.id } });
    expect([o.ipAddress, o.userAgent, o.granted]).toEqual([null, null, true]);
    const y = await prisma.gdprConsent.findUniqueOrThrow({ where: { id: young.id } });
    expect(y.ipAddress).toBe('203.0.113.6');
    expect((await jobs.runConsentMetadataRetention({ now: NOW, mode: ARMED })).affected).toBe(0);
  });

  it('audit logs past seven years are deleted; one day short stays; a COMPLIANCE_JOB_RUN row inside seven years is never deleted', async () => {
    const mk = (action: string, at: Date) =>
      prisma.auditLog.create({
        data: { action, entityType: `${TAG}-audit`, entityId: 'x', createdAt: at },
      });
    const old = await mk('ADMIN_ACTION', yearsAgo(7, 1));
    const edge = await mk('ADMIN_ACTION', yearsAgo(7, -1));
    const run = await mk('COMPLIANCE_JOB_RUN', yearsAgo(6));
    const r = await jobs.runAuditLogsRetention({ now: NOW, batch: 1, mode: ARMED });
    expect(r.affected).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: edge.id } })).not.toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: run.id } })).not.toBeNull();
  });

  it('batches: a run of 5 rows at batch 2 writes 3 log rows, counts only, and a re-run writes none', async () => {
    const c = await user('CLIENT');
    for (let i = 0; i < 5; i += 1) {
      await prisma.notification.create({
        data: {
          userId: c.id,
          type: 'BOOKING_CONFIRMED',
          title: 'x',
          body: 'x',
          createdAt: yearsAgo(3),
        },
      });
    }
    const r = await jobs.runNotificationsRetention({ now: NOW, batch: 2, mode: ARMED });
    expect([r.batches, r.affected]).toEqual([3, 5]);
    const logs = await prisma.dataRetentionLog.findMany({
      where: { entityType: 'notifications', entityId: 'batch' },
    });
    expect(logs).toHaveLength(3);
    expect(logs.map((l) => (l.metadata as { affected: number }).affected).sort()).toEqual([
      1, 2, 2,
    ]);
    expect(
      (await jobs.runNotificationsRetention({ now: NOW, batch: 2, mode: ARMED })).batches
    ).toBe(0);
  });

  // ─── The compliance gate (finding a) ───────────────────────────────────

  describe('the compliance day gate', () => {
    const DAY = 'last_compliance_run_date';
    const ATTEMPT = 'last_compliance_attempt';
    const ok = (job: string) => ({ job, success: true, details: {}, executedAt: new Date() });
    const bad = (job: string) => ({ job, success: false, details: {}, executedAt: new Date() });
    const marker = async (key: string) =>
      (await prisma.platformConfig.findUniqueOrThrow({ where: { key } })).value;
    const reset = async () => {
      await prisma.platformConfig.upsert({
        where: { key: DAY },
        update: { value: '1970-01-01' },
        create: { key: DAY, value: '1970-01-01' },
      });
      await prisma.platformConfig.upsert({
        where: { key: ATTEMPT },
        update: { value: '{}' },
        create: { key: ATTEMPT, value: '{}' },
      });
    };
    beforeEach(reset);
    afterAll(reset);

    it('a failed job never writes the day marker; the failure is carried on every tick; the retry waits an hour; a clean retry writes the marker and clears the attempt', async () => {
      const spy = vi
        .spyOn(compliance.ComplianceSchedulerService, 'runAllJobs')
        .mockResolvedValue([ok('a'), bad('check_dpa_agreement_renewals'), ok('c')]);
      const today = new Date().toISOString().slice(0, 10);

      const first = await scheduler.processComplianceJobsDaily();
      expect(first.processed).toBe(3);
      expect(first.failed).toEqual(['check_dpa_agreement_renewals']);
      expect(await marker(DAY)).toBe('1970-01-01');
      const attempt = JSON.parse(await marker(ATTEMPT)) as {
        attemptedAt: string;
        failed: string[];
      };
      expect(attempt.failed).toEqual(['check_dpa_agreement_renewals']);

      const second = await scheduler.processComplianceJobsDaily();
      expect(second).toEqual({ processed: 0, failed: ['check_dpa_agreement_renewals'] });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(await marker(DAY)).toBe('1970-01-01');

      // Age the attempt past the hour: the retry runs, now clean.
      await prisma.platformConfig.update({
        where: { key: ATTEMPT },
        data: {
          value: JSON.stringify({
            ...attempt,
            attemptedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
          }),
        },
      });
      spy.mockResolvedValue([ok('a'), ok('check_dpa_agreement_renewals'), ok('c')]);
      const third = await scheduler.processComplianceJobsDaily();
      expect(third.processed).toBe(3);
      expect(third.failed).toBeUndefined();
      expect(await marker(DAY)).toBe(today);
      expect(await marker(ATTEMPT)).toBe('{}');

      const fourth = await scheduler.processComplianceJobsDaily();
      expect(fourth).toEqual({ processed: 0 });
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('a batch that throws is a failed batch, not a skipped day', async () => {
      vi.spyOn(compliance.ComplianceSchedulerService, 'runAllJobs').mockRejectedValue(
        new Error('boom')
      );
      const r = await scheduler.processComplianceJobsDaily();
      expect(r).toEqual({ processed: 0, failed: ['batch'] });
      expect(await marker(DAY)).toBe('1970-01-01');
      expect(JSON.parse(await marker(ATTEMPT)).failed).toEqual(['batch']);
    });

    it('two overlapping ticks run the batch once (atomic attempt claim)', async () => {
      const spy = vi
        .spyOn(compliance.ComplianceSchedulerService, 'runAllJobs')
        .mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, 50));
          return [ok('a')];
        });
      const [a, b] = await Promise.all([
        scheduler.processComplianceJobsDaily(),
        scheduler.processComplianceJobsDaily(),
      ]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect([a.processed, b.processed].sort()).toEqual([0, 1]);
    });

    it('a summary that carries a compliance failure is a failed run for the heartbeat', async () => {
      await lease.claimSchedulerLease('b7r-test');
      await lease.releaseSchedulerLease({
        summary: { probe: true },
        error: new Error('compliance jobs failed: x'),
      });
      const row = await prisma.schedulerLease.findUniqueOrThrow({
        where: { id: lease.SCHEDULER_LEASE_ID },
      });
      expect(row.lastFailedAt).not.toBeNull();
      expect(row.lastError).toContain('compliance jobs failed');
      expect(row.lastSummary).toEqual({ probe: true });
      // Once the last clean run is older than the stale window, the status is
      // failing, not stale. The lease row is shared with the other suites (CI
      // runs the lease suite seconds earlier and leaves a fresh success), so
      // the probe time is taken from the newer of the two stamps, not from
      // now: inside the window the row reads healthy by design.
      if (!row.lastFailedAt) throw new Error('lastFailedAt not set');
      const newest = Math.max(row.lastFailedAt.getTime(), row.lastSucceededAt?.getTime() ?? 0);
      const inside = new Date(newest + 1000);
      const later = new Date(newest + lease.STALE_AFTER_MS + 1000);
      expect(lease.heartbeatStatus(row, inside)).toBe(
        row.lastSucceededAt && row.lastSucceededAt > row.lastFailedAt ? 'healthy' : 'failing'
      );
      expect(lease.heartbeatStatus(row, later)).toBe('failing');
    });
  });
});
