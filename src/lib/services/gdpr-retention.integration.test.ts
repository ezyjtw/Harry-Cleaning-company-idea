import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as GdprModule from '@/lib/services/gdpr.service';

// B7.9 (RENA-076, D-n): analytics anonymisation against a real Postgres.
// Opt-in: GDPR_RETENTION_INTEGRATION=1 and DATABASE_URL at a migrated
// database (the rig or the CI e2e job's service container). Synthetic rows
// only: a documentation-range address, no real person, no real page.
const enabled = process.env.GDPR_RETENTION_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION = 'b7-retention-integration';

describe.skipIf(!enabled)('analytics retention cleanup against Postgres (B7.9)', () => {
  let prisma: typeof PrismaDefault;
  let gdpr: typeof GdprModule;

  beforeAll(async () => {
    prisma = (await import('@/lib/db/prisma')).default;
    gdpr = await import('@/lib/services/gdpr.service');
  });

  beforeEach(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { sessionId: SESSION } });
    await prisma.dataRetentionLog.deleteMany({ where: { entityType: 'AnalyticsEvent' } });
  });

  afterAll(async () => {
    await prisma.analyticsEvent.deleteMany({ where: { sessionId: SESSION } });
    await prisma.$disconnect();
  });

  const ageDays = (days: number) => new Date(Date.now() - days * DAY_MS);

  type Seed = Omit<Prisma.AnalyticsEventUncheckedCreateInput, 'sessionId' | 'eventType'>;
  async function seed(rows: Seed[]) {
    const ids: string[] = [];
    for (const data of rows) {
      const r = await prisma.analyticsEvent.create({
        data: { ...data, sessionId: SESSION, eventType: 'PAGE_VIEW' },
      });
      ids.push(r.id);
    }
    return ids;
  }

  it('a null-IP row with a userId past the horizon loses the userId; the old WHERE kept it', async () => {
    const [oldNullIp, young] = await seed([
      { userId: 'b7-user-old', ipAddress: null, createdAt: ageDays(731) },
      { userId: 'b7-user-young', ipAddress: null, createdAt: ageDays(729) },
    ]);
    const result = await gdpr.GdprService.runRetentionCleanup(730);
    expect(result.anonymisedCount).toBe(1);
    const a = await prisma.analyticsEvent.findUniqueOrThrow({ where: { id: oldNullIp } });
    const b = await prisma.analyticsEvent.findUniqueOrThrow({ where: { id: young } });
    expect(a.userId).toBeNull();
    expect(b.userId).toBe('b7-user-young');
  });

  it('referrer is nulled and page keeps only its path (approved deviation 8)', async () => {
    const [id] = await seed([
      {
        ipAddress: '203.0.113.9',
        referrer: 'https://search.invalid/?q=terms',
        page: '/services/deep?utm=x#step-2',
        createdAt: ageDays(800),
      },
    ]);
    const result = await gdpr.GdprService.runRetentionCleanup(730);
    expect(result.pagesTrimmed).toBe(1);
    const row = await prisma.analyticsEvent.findUniqueOrThrow({ where: { id } });
    expect(row.ipAddress).toBeNull();
    expect(row.referrer).toBeNull();
    expect(row.page).toBe('/services/deep');
  });

  it('a second run selects nothing (idempotent) and the log row carries counts only', async () => {
    await seed([{ userId: 'b7-user-old', ipAddress: '203.0.113.10', createdAt: ageDays(900) }]);
    await gdpr.GdprService.runRetentionCleanup(730);
    const again = await gdpr.GdprService.runRetentionCleanup(730);
    expect(again).toEqual({ anonymisedCount: 0, pagesTrimmed: 0 });
    const logs = await prisma.dataRetentionLog.findMany({
      where: { entityType: 'AnalyticsEvent' },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    const meta = logs[0].metadata as Record<string, unknown>;
    expect(Object.keys(meta).sort()).toEqual(
      ['cutoffDate', 'pagesTrimmed', 'recordsAnonymised', 'retentionDays'].sort()
    );
    expect(JSON.stringify(meta)).not.toContain('203.0.113');
  });
});
