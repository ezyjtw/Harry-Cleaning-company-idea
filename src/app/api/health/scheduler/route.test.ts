import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-014: the heartbeat endpoint is 200 while the last finished run is
// fresh and 503 when it is stale, missing or unreadable.
const heartbeat = vi.fn();

vi.mock('@/lib/services/scheduler-lease.service', () => ({
  getSchedulerHeartbeat: (...args: unknown[]) => heartbeat(...args),
}));

import { GET } from './route';

describe('GET /api/health/scheduler (RENA-014)', () => {
  beforeEach(() => heartbeat.mockReset());

  it('returns 200 when the heartbeat is fresh', async () => {
    heartbeat.mockResolvedValueOnce({ status: 'ok', ageSeconds: 120 });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.json()).status).toBe('ok');
  });

  it('returns 503 when the heartbeat is stale', async () => {
    heartbeat.mockResolvedValueOnce({ status: 'stale', ageSeconds: 1800 });
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it('returns 503 when the heartbeat cannot be read', async () => {
    heartbeat.mockRejectedValueOnce(new Error('db down'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe('stale');
  });
});
