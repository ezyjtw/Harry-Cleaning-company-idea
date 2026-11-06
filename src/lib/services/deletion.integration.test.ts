import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as ComplianceModule from '@/lib/services/compliance-scheduler.service';
import type * as DocModule from '@/lib/services/document-storage.service';
import type * as EmailModule from '@/lib/services/email.service';
import type * as GdprModule from '@/lib/services/gdpr.service';

// B7.5 (RENA-065, James: before any IN_PROGRESS recovery is accepted): the
// deletion executor is idempotent and resumable. A run is killed at each of
// five stages, left IN_PROGRESS, recovered after 24 hours and retried to
// completion with a consistent end state. Then the SLA: chips, the backlog
// alert, the recovery flag, and audit rows that carry no email.
const enabled = process.env.DELETION_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const DAY_MS = 24 * 60 * 60 * 1000;
const TAG = 'b7d';

type BacklogPayload = { ids: string[]; total: number; overdue: number; oldestAgeDays: number };
const emailMock = vi.hoisted(() => ({
  sendAdminDeletionBacklog: vi.fn(async (_data: BacklogPayload) => true),
}));
vi.mock('@/lib/services/email.service', async (importOriginal) => ({
  ...(await importOriginal<typeof EmailModule>()),
  sendAdminDeletionBacklog: emailMock.sendAdminDeletionBacklog,
}));

describe.skipIf(!enabled)('deletion executor and SLA against Postgres (B7.5)', () => {
  let prisma: typeof PrismaDefault;
  let gdpr: typeof GdprModule;
  let docs: typeof DocModule;
  let compliance: typeof ComplianceModule;

  async function wipe() {
    // Tombstoned fixtures no longer carry the tag address; their requests do.
    const reqs = await prisma.dataDeletionRequest.findMany({
      where: { email: { endsWith: `@${TAG}.integration.invalid` } },
      select: { userId: true },
    });
    await prisma.user.deleteMany({ where: { id: { in: reqs.map((r) => r.userId) } } });
    await prisma.dataDeletionRequest.deleteMany({
      where: { email: { endsWith: `@${TAG}.integration.invalid` } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${TAG}.integration.invalid` } } });
  }

  beforeAll(async () => {
    process.env.LOG_HMAC_KEY = process.env.LOG_HMAC_KEY || 'integration-only-hmac-key';
    prisma = (await import('@/lib/db/prisma')).default;
    gdpr = await import('@/lib/services/gdpr.service');
    docs = await import('@/lib/services/document-storage.service');
    compliance = await import('@/lib/services/compliance-scheduler.service');
    await wipe();
  });
  beforeEach(async () => {
    await wipe();
    emailMock.sendAdminDeletionBacklog.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  let seq = 0;
  async function fixtureAccount() {
    seq += 1;
    const email = `customer-${seq}-${Date.now()}@${TAG}.integration.invalid`;
    const u = await prisma.user.create({
      data: { email, name: 'Fixture Customer', phone: '07000000002', role: 'CLIENT' },
    });
    const k = await prisma.user.create({
      data: {
        email: `cleaner-${seq}-${Date.now()}@${TAG}.integration.invalid`,
        name: 'Fixture Cleaner',
        role: 'CLEANER',
      },
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
    const b = await prisma.booking.create({
      data: {
        clientId: u.id,
        cleanerId: k.id,
        serviceType: 'regular',
        date: new Date(Date.now() - 400 * DAY_MS),
        startTime: '10:00',
        duration: 2,
        totalPrice: 60,
        platformFee: 6,
        cleanerEarnings: 50,
        status: 'COMPLETED',
        paymentStatus: 'SUCCEEDED',
        transferStatus: 'RELEASED',
        addressPostcode: 'E4 7AA',
      } as never,
    });
    for (let i = 0; i < 3; i += 1) {
      await prisma.message.create({
        data: { bookingId: b.id, senderId: u.id, receiverId: k.id, content: `hello ${i}` },
      });
    }
    await prisma.gdprConsent.create({
      data: { userId: u.id, email, consentType: 'marketing', granted: true },
    });
    await prisma.analyticsEvent.create({
      data: {
        sessionId: `${TAG}-s`,
        eventType: 'PAGE_VIEW',
        userId: u.id,
        ipAddress: '203.0.113.7',
      },
    });
    await prisma.documentUpload.create({
      data: {
        userId: u.id,
        documentType: 'photo_id',
        originalName: 'id.png',
        storagePath: `documents/photo_id/${TAG}-${seq}.enc`,
        mimeType: 'image/png',
        fileSize: 1,
        encryptionKeyId: 'k',
        checksum: 'x',
        storageState: 'STORED',
      },
    });
    const req = await gdpr.GdprService.requestDataDeletion({ userId: u.id, email, reason: 'test' });
    await gdpr.GdprService.approveDataDeletion({ requestId: req.id, adminId: 'SYSTEM' });
    return { u, k, b, req, email };
  }

  async function status(id: string) {
    return (await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id } })).status;
  }
  async function ageClaim(id: string, hours: number) {
    await prisma.$executeRaw`UPDATE "DataDeletionRequest" SET "updatedAt" = NOW() - (${hours}::int * INTERVAL '1 hour') WHERE "id" = ${id}`;
  }
  async function endState(u: { id: string }) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    return {
      isDeleted: user.isDeleted,
      email: user.email,
      addresses: await prisma.address.count({ where: { userId: u.id } }),
      redacted: await prisma.message.count({
        where: { senderId: u.id, content: gdpr.DELETION_MESSAGE_REDACTED },
      }),
      consentsGranted: await prisma.gdprConsent.count({ where: { userId: u.id, granted: true } }),
      analyticsWithUser: await prisma.analyticsEvent.count({ where: { userId: u.id } }),
      docsLive: await prisma.documentUpload.count({ where: { userId: u.id, isDestroyed: false } }),
      logs: await prisma.dataRetentionLog.count({
        where: { entityType: 'User', entityId: u.id, action: 'ANONYMISED' },
      }),
    };
  }
  const COMPLETE = {
    isDeleted: true,
    addresses: 0,
    redacted: 3,
    consentsGranted: 0,
    analyticsWithUser: 0,
    docsLive: 0,
    logs: 1,
  };

  type Injection = {
    stage: string;
    arm: () => void;
    before: (s: Awaited<ReturnType<typeof endState>>) => void;
  };
  const injections: Injection[] = [
    {
      stage: 'documents',
      arm: () =>
        vi
          .spyOn(docs.DocumentStorageService, 'destroyDocument')
          .mockRejectedValueOnce(new Error('r2 down')),
      before: (s) => {
        expect(s.docsLive).toBe(1);
        expect(s.redacted).toBe(0);
        expect(s.addresses).toBe(1);
      },
    },
    {
      stage: 'messages',
      arm: () => vi.spyOn(prisma.message, 'updateMany').mockRejectedValueOnce(new Error('db blip')),
      before: (s) => {
        expect(s.docsLive).toBe(0);
        expect(s.redacted).toBe(0);
        expect(s.addresses).toBe(1);
      },
    },
    {
      stage: 'addresses',
      arm: () => vi.spyOn(prisma.address, 'deleteMany').mockRejectedValueOnce(new Error('db blip')),
      before: (s) => {
        expect(s.redacted).toBe(3);
        expect(s.consentsGranted).toBe(0);
        expect(s.addresses).toBe(1);
        expect(s.isDeleted).toBe(false);
      },
    },
    {
      stage: 'tombstone',
      arm: () => vi.spyOn(prisma.user, 'updateMany').mockRejectedValueOnce(new Error('db blip')),
      before: (s) => {
        expect(s.addresses).toBe(0);
        expect(s.isDeleted).toBe(false);
        expect(s.logs).toBe(0);
      },
    },
    {
      stage: 'complete',
      arm: () =>
        vi.spyOn(prisma.dataDeletionRequest, 'update').mockRejectedValueOnce(new Error('db blip')),
      before: (s) => {
        expect(s.isDeleted).toBe(true);
        expect(s.logs).toBe(1);
      },
    },
  ];

  for (const inj of injections) {
    it(`a run killed at the ${inj.stage} stage stays IN_PROGRESS, is recovered after 24 hours, and the retry completes to the same end state`, async () => {
      const { u, req } = await fixtureAccount();
      inj.arm();
      await expect(
        gdpr.GdprService.processDataDeletion({ requestId: req.id, processedBy: 'SYSTEM' })
      ).rejects.toThrow();
      vi.restoreAllMocks();
      expect(await status(req.id)).toBe('IN_PROGRESS');
      inj.before(await endState(u));

      // Younger than 24 hours: a live run owns it, the recovery leaves it.
      expect((await gdpr.GdprService.recoverStalledDeletions()).recovered).toBe(0);
      expect(await status(req.id)).toBe('IN_PROGRESS');

      await ageClaim(req.id, 25);
      const rec = await gdpr.GdprService.recoverStalledDeletions();
      expect(rec).toEqual({ recovered: 1, flagged: 0 });
      const row = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id: req.id } });
      expect(row.status).toBe('APPROVED');
      expect(row.notes).toContain(gdpr.GdprService.RECOVERY_NOTE);

      const result = await gdpr.GdprService.processDataDeletion({
        requestId: req.id,
        processedBy: 'SYSTEM',
      });
      expect(result.success).toBe(true);
      expect(await status(req.id)).toBe('COMPLETED');
      const end = await endState(u);
      expect(end).toMatchObject({ ...COMPLETE, logs: inj.stage === 'complete' ? 2 : 1 });
      expect(end.email).toBe(`deleted+${u.id}@deleted.invalid`);
      // Nothing is double-counted: the retry's manifest reports the remainder.
      if (inj.stage === 'addresses') expect(result.manifest.messagesRedacted).toBe(0);
      if (inj.stage === 'documents') expect(result.manifest.messagesRedacted).toBe(3);
    });
  }

  it('every completed stage advances updatedAt, so recovery means 24 hours without progress (B7b delta)', async () => {
    const { req } = await fixtureAccount();
    await prisma.$executeRaw`UPDATE "DataDeletionRequest" SET "updatedAt" = NOW() - INTERVAL '30 hours' WHERE "id" = ${req.id}`;
    const before = (await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id: req.id } }))
      .updatedAt;
    vi.spyOn(prisma.address, 'deleteMany').mockRejectedValueOnce(new Error('db blip'));
    await expect(
      gdpr.GdprService.processDataDeletion({ requestId: req.id, processedBy: 'SYSTEM' })
    ).rejects.toThrow();
    vi.restoreAllMocks();
    const after = (await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id: req.id } }))
      .updatedAt;
    // The documents, messages, analytics and consents stages completed and each stamped progress.
    expect(after.getTime()).toBeGreaterThan(before.getTime());
    expect(Date.now() - after.getTime()).toBeLessThan(60_000);
    // Progress inside the last 24 hours: the recovery leaves it alone even though the claim is 30 hours old.
    expect((await gdpr.GdprService.recoverStalledDeletions()).recovered).toBe(0);
    expect(await status(req.id)).toBe('IN_PROGRESS');
  });

  it('a clean run completes once; a second call refuses (not APPROVED)', async () => {
    const { req } = await fixtureAccount();
    const r = await gdpr.GdprService.processDataDeletion({
      requestId: req.id,
      processedBy: 'SYSTEM',
    });
    expect(r.success).toBe(true);
    await expect(
      gdpr.GdprService.processDataDeletion({ requestId: req.id, processedBy: 'SYSTEM' })
    ).rejects.toThrow(/APPROVED/);
  });

  it('three recoveries flag the request for attention and it sorts first in the admin queue', async () => {
    const { req } = await fixtureAccount();
    const other = await fixtureAccount();
    const line = `${gdpr.GdprService.RECOVERY_NOTE} at earlier (1)\n${gdpr.GdprService.RECOVERY_NOTE} at earlier (2)`;
    await prisma.dataDeletionRequest.update({
      where: { id: req.id },
      data: { status: 'IN_PROGRESS', notes: line },
    });
    await ageClaim(req.id, 30);
    expect(await gdpr.GdprService.recoverStalledDeletions()).toEqual({ recovered: 1, flagged: 1 });
    const queue = await gdpr.GdprService.getManageableDeletionRequests();
    const ours = queue.filter((r) => [req.id, other.req.id].includes(r.id));
    expect(ours[0].id).toBe(req.id);
    expect(ours[0].needsAttention).toBe(true);
    expect(ours[0].recoveries).toBe(3);
    expect(ours[0].notes).toContain('needsAttention');
    expect(ours[1].needsAttention).toBe(false);
  });

  it('SLA: fixtures at 20, 22 and 31 days show no chip, Due soon, Overdue; the backlog picks 22 and 31 and one mail goes', async () => {
    const mk = async (days: number) => {
      const { req } = await fixtureAccount();
      await prisma.dataDeletionRequest.update({
        where: { id: req.id },
        data: { status: 'PENDING', requestedAt: new Date(Date.now() - days * DAY_MS - 60_000) },
      });
      return req.id;
    };
    const [d20, d22, d31] = [await mk(20), await mk(22), await mk(31)];
    const queue = await gdpr.GdprService.getManageableDeletionRequests();
    const chip = (id: string) => queue.find((r) => r.id === id)?.slaChip;
    expect([chip(d20), chip(d22), chip(d31)]).toEqual(['none', 'due_soon', 'overdue']);

    const backlog = await gdpr.GdprService.deletionBacklog();
    const ours = backlog.ids.filter((id) => [d20, d22, d31].includes(id));
    expect(ours.sort()).toEqual([d22, d31].sort());
    expect(backlog.oldestAgeDays).toBeGreaterThanOrEqual(31);

    const job = await compliance.ComplianceSchedulerService.alertDeletionBacklog();
    expect(job.success).toBe(true);
    expect(emailMock.sendAdminDeletionBacklog).toHaveBeenCalledTimes(1);
    const payload = emailMock.sendAdminDeletionBacklog.mock.calls[0][0];
    expect(payload.ids).toContain(d22);
    expect(payload.ids).toContain(d31);
    expect(payload.ids).not.toContain(d20);
    expect(JSON.stringify(payload)).not.toContain('@');
    const glance = await gdpr.GdprService.deletionQueueGlance();
    expect(glance.open).toBeGreaterThanOrEqual(3);
    expect(glance.oldestAgeDays).toBeGreaterThanOrEqual(31);
  });

  it('audit rows for a deletion request carry a pseudonym and never the email', async () => {
    const { req, email } = await fixtureAccount();
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'DataDeletionRequest', entityId: req.id },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) {
      const text = JSON.stringify(r.metadata);
      expect(text).not.toContain(email);
      expect(text).not.toContain('@');
    }
    const requested = rows.find(
      (r) => (r.metadata as { action: string }).action === 'DATA_DELETION_REQUESTED'
    );
    expect((requested?.metadata as { requester: string } | undefined)?.requester).toMatch(
      /^p:[0-9a-f]{16}$/
    );
  });
});
