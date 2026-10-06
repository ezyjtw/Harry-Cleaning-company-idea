import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';

import type * as LeaseModule from './scheduler-lease.service';

// RENA-014 concurrency proof against a real Postgres (register rule 7: a
// concurrency fix ships with a concurrency test, not a unit test alone).
// Opt-in: runs only when SCHEDULER_LEASE_INTEGRATION=1 and DATABASE_URL point
// at a migrated database (the rig, or the CI e2e job's service container).
const enabled = process.env.SCHEDULER_LEASE_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('scheduler lease against Postgres (RENA-014)', () => {
  let prisma: typeof PrismaDefault;
  let lease: typeof LeaseModule;

  beforeEach(async () => {
    prisma = (await import('@/lib/db/prisma')).default;
    lease = await import('./scheduler-lease.service');
    await prisma.schedulerLease.upsert({
      where: { id: lease.SCHEDULER_LEASE_ID },
      create: { id: lease.SCHEDULER_LEASE_ID },
      update: { lockedAt: null, lastStartedAt: null, lastFinishedAt: null, lastError: null },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('exactly one of ten simultaneous claims wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => lease.claimSchedulerLease(`probe-${i}`))
    );
    const winners = results.filter((r) => r.claimed);
    expect(winners).toHaveLength(1);
    const row = await prisma.schedulerLease.findUnique({ where: { id: lease.SCHEDULER_LEASE_ID } });
    expect(row?.lockedAt).not.toBeNull();
  });

  it('a second claim is refused while the window is open, even after the run finished', async () => {
    const first = await lease.claimSchedulerLease('first');
    expect(first.claimed).toBe(true);
    const second = await lease.claimSchedulerLease('second');
    expect(second.claimed).toBe(false);

    // The production pair arrives seconds apart, after the first run has
    // already finished: release must not reopen the window.
    await lease.releaseSchedulerLease({ summary: { probe: true } });
    const third = await lease.claimSchedulerLease('third');
    expect(third.claimed).toBe(false);

    // The next tick, after the TTL, claims again.
    await prisma.schedulerLease.update({
      where: { id: lease.SCHEDULER_LEASE_ID },
      data: { lockedAt: new Date(Date.now() - lease.LEASE_TTL_MS - 1000) },
    });
    const nextTick = await lease.claimSchedulerLease('next-tick');
    expect(nextTick.claimed).toBe(true);
    await lease.releaseSchedulerLease({ summary: { probe: true } });
  });

  it('a lock older than the TTL (a crashed run) can be reclaimed', async () => {
    const old = new Date(Date.now() - lease.LEASE_TTL_MS - 1000);
    await prisma.schedulerLease.update({
      where: { id: lease.SCHEDULER_LEASE_ID },
      data: { lockedAt: old },
    });
    const claim = await lease.claimSchedulerLease('after-crash');
    expect(claim.claimed).toBe(true);
    await lease.releaseSchedulerLease({ error: 'probe' });
  });

  it('the heartbeat is ok right after a release and stale when old', async () => {
    const claim = await lease.claimSchedulerLease('hb');
    expect(claim.claimed).toBe(true);
    await lease.releaseSchedulerLease({ summary: { probe: true } });
    const fresh = await lease.getSchedulerHeartbeat();
    expect(fresh.status).toBe('ok');
    expect(fresh.ageSeconds).toBeLessThan(5);

    const later = new Date(Date.now() + lease.STALE_AFTER_MS + 1000);
    const stale = await lease.getSchedulerHeartbeat(later);
    expect(stale.status).toBe('stale');
  });
});
