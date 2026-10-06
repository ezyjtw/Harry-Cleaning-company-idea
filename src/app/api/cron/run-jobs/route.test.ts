import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-014: the cron route runs the jobs only when it holds the lease, answers
// 200 "skipped" when another caller holds it, and releases the lease with the
// summary on success or the error on failure.
const claim = vi.fn();
const release = vi.fn();
const run = vi.fn();

vi.mock('@/lib/services/scheduler-lease.service', () => ({
  callerLabel: (ua: string | null) => ua,
  claimSchedulerLease: (...args: unknown[]) => claim(...args),
  releaseSchedulerLease: (...args: unknown[]) => release(...args),
}));
vi.mock('@/lib/services/scheduler.service', () => ({
  runScheduledJobs: (...args: unknown[]) => run(...args),
}));

import { POST } from './route';

function post(): NextRequest {
  return new NextRequest('http://localhost/api/cron/run-jobs', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret', 'user-agent': 'Bun/1.3.0' },
  });
}

describe('POST /api/cron/run-jobs lease (RENA-014)', () => {
  beforeEach(() => {
    claim.mockReset();
    release.mockReset();
    run.mockReset();
    release.mockResolvedValue(undefined);
    process.env.CRON_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects a wrong secret before touching the lease', async () => {
    const req = new NextRequest('http://localhost/api/cron/run-jobs', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(claim).not.toHaveBeenCalled();
  });

  it('runs the jobs and releases with the summary when the lease is claimed', async () => {
    const now = new Date();
    claim.mockResolvedValueOnce({ claimed: true, now, lockedUntil: now, lastStartedAt: now });
    run.mockResolvedValueOnce({ timestamp: now.toISOString(), releases: { processed: 0 } });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(claim).toHaveBeenCalledWith('Bun/1.3.0');
    expect(run).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith({
      summary: { timestamp: now.toISOString(), releases: { processed: 0 } },
    });
    const body = await res.json();
    expect(body.releases.processed).toBe(0);
  });

  it('answers 200 skipped and never runs when the lease is held', async () => {
    const now = new Date();
    claim.mockResolvedValueOnce({
      claimed: false,
      reason: 'cadence',
      now,
      lockedUntil: now,
      lastStartedAt: now,
    });
    const res = await POST(post());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe('lease held');
    expect(body.reason).toBe('cadence');
    expect(run).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('releases with the error and answers 500 when a job throws', async () => {
    const now = new Date();
    claim.mockResolvedValueOnce({ claimed: true, now, lockedUntil: now, lastStartedAt: now });
    const boom = new Error('boom');
    run.mockRejectedValueOnce(boom);
    const res = await POST(post());
    expect(res.status).toBe(500);
    expect(release).toHaveBeenCalledWith({ error: boom });
  });
});
