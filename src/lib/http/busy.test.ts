import { describe, expect, it } from 'vitest';

import { CleanerBusyError } from '@/lib/booking/assign';

import { busyResponse, mapBusy } from './busy';

// B3 gate (James-ruled): ONLY the recognised lock-wait timeout answers 503.
describe('busyResponse', () => {
  it('maps CleanerBusyError to 503 BUSY with Retry-After', async () => {
    const res = busyResponse(new CleanerBusyError());
    expect(res?.status).toBe(503);
    expect(res?.headers.get('Retry-After')).toBe('5');
    expect(await res?.json()).toEqual({ error: 'BUSY', message: expect.any(String) });
  });

  it('never maps other failures, Prisma transaction errors included', () => {
    const poolStart = Object.assign(new Error('Unable to start a transaction in the given time.'), {
      code: 'P2028',
      meta: { error: 'Unable to start a transaction in the given time.' },
    });
    const expired = Object.assign(new Error('expired transaction'), {
      code: 'P2028',
      meta: { error: 'A query cannot be executed on an expired transaction.' },
    });
    for (const err of [new Error('boom'), poolStart, expired, { code: 'BUSY' }, null]) {
      expect(busyResponse(err)).toBeNull();
    }
  });

  it('mapBusy rethrows everything that is not busy', async () => {
    const boom = mapBusy(async () => {
      throw new Error('db down');
    });
    await expect(boom()).rejects.toThrow('db down');
    const busy = mapBusy(async () => {
      throw new CleanerBusyError();
    });
    expect((await busy()).status).toBe(503);
  });
});
