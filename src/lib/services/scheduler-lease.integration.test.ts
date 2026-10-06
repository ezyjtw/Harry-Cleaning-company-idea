import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';

import type * as LeaseModule from './scheduler-lease.service';

// RENA-014 concurrency and heartbeat proof against a real Postgres (register
// rule 7: a concurrency fix ships with a concurrency test, not a unit test
// alone). Opt-in: runs only when SCHEDULER_LEASE_INTEGRATION=1 and
// DATABASE_URL point at a migrated database (the rig, or the CI e2e job's
// service container).
const enabled = process.env.SCHEDULER_LEASE_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('scheduler lease against Postgres (RENA-014)', () => {
  let prisma: typeof PrismaDefault;
  let lease: typeof LeaseModule;

  async function reset(): Promise<void> {
    await prisma.schedulerLease.upsert({
      where: { id: lease.SCHEDULER_LEASE_ID },
      create: { id: lease.SCHEDULER_LEASE_ID },
      update: {
        lockedUntil: null,
        lastStartedAt: null,
        lastSucceededAt: null,
        lastFailedAt: null,
        lastError: null,
        lastCaller: null,
      },
    });
  }

  async function set(data: {
    lockedUntil?: Date | null;
    lastStartedAt?: Date | null;
    lastSucceededAt?: Date | null;
    lastFailedAt?: Date | null;
  }): Promise<void> {
    await prisma.schedulerLease.update({ where: { id: lease.SCHEDULER_LEASE_ID }, data });
  }

  beforeEach(async () => {
    prisma = (await import('@/lib/db/prisma')).default;
    lease = await import('./scheduler-lease.service');
    await reset();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('exactly one of ten simultaneous claims wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => lease.claimSchedulerLease(`probe-${i}`))
    );
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    const row = await prisma.schedulerLease.findUnique({ where: { id: lease.SCHEDULER_LEASE_ID } });
    expect(row?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it('cadence: a claim after a finished run is refused until four minutes have passed', async () => {
    const first = await lease.claimSchedulerLease('first');
    expect(first.claimed).toBe(true);
    await lease.releaseSchedulerLease({ summary: { probe: true } });

    // The production pair arrives seconds apart, after the first run finished.
    const second = await lease.claimSchedulerLease('second');
    expect(second.claimed).toBe(false);
    expect(second.reason).toBe('cadence');

    await set({ lastStartedAt: new Date(Date.now() - lease.CADENCE_MS - 1000) });
    const nextTick = await lease.claimSchedulerLease('next-tick');
    expect(nextTick.claimed).toBe(true);
    await lease.releaseSchedulerLease({ summary: { probe: true } });
  });

  it('running lock: a run in progress is never overlapped; a crashed run is recovered after ten minutes', async () => {
    const first = await lease.claimSchedulerLease('first');
    expect(first.claimed).toBe(true);

    // Cadence has elapsed but the run never released (crash): still locked.
    await set({ lastStartedAt: new Date(Date.now() - lease.CADENCE_MS - 1000) });
    const overlap = await lease.claimSchedulerLease('overlap');
    expect(overlap.claimed).toBe(false);
    expect(overlap.reason).toBe('running');

    await set({ lockedUntil: new Date(Date.now() - 1000) });
    const recovered = await lease.claimSchedulerLease('recovered');
    expect(recovered.claimed).toBe(true);
    await lease.releaseSchedulerLease({ summary: { probe: true } });
  });

  it('heartbeat: repeated failures do not keep it healthy; a later success restores it', async () => {
    const run = async (outcome: { summary: object } | { error: unknown }) => {
      await set({
        lastStartedAt: new Date(Date.now() - lease.CADENCE_MS - 1000),
        lockedUntil: null,
      });
      const claim = await lease.claimSchedulerLease('hb');
      expect(claim.claimed).toBe(true);
      await lease.releaseSchedulerLease(outcome);
    };

    await run({ summary: { probe: true } });
    expect((await lease.getSchedulerHeartbeat()).status).toBe('healthy');

    // Age the success past the window, then two failing ticks: failing, not healthy.
    await set({ lastSucceededAt: new Date(Date.now() - lease.STALE_AFTER_MS - 1000) });
    await run({ error: new Error('boom one\nstack line') });
    await run({ error: new Error('boom two') });
    const failing = await lease.getSchedulerHeartbeat();
    expect(failing.status).toBe('failing');
    const row = await prisma.schedulerLease.findUnique({ where: { id: lease.SCHEDULER_LEASE_ID } });
    expect(row?.lastError).toBe('boom two');
    expect(JSON.stringify(failing)).not.toContain('boom');

    // Recent failures within the window never count as healthy either.
    await set({ lastSucceededAt: null });
    expect((await lease.getSchedulerHeartbeat()).status).toBe('failing');

    await run({ summary: { probe: true } });
    const restored = await lease.getSchedulerHeartbeat();
    expect(restored.status).toBe('healthy');
    expect(restored.ageSeconds).toBeLessThan(5);

    const later = new Date(Date.now() + lease.STALE_AFTER_MS + 1000);
    expect((await lease.getSchedulerHeartbeat(later)).status).toBe('stale');
  });
});
