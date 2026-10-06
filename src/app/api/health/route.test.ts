import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-061: the health probe is 200 only when SELECT 1 succeeds; a database
// failure is a 503 with the same body shape (status degraded, database
// disconnected). The Prisma client is mocked at the module boundary.
const queryRaw = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  default: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

import { GET } from './route';

describe('GET /api/health (RENA-061)', () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('returns 200 with database connected when SELECT 1 succeeds', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 503 with database disconnected when SELECT 1 throws', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('disconnected');
    expect(typeof body.timestamp).toBe('string');
  });
});
