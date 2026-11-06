import { afterEach, describe, expect, it, vi } from 'vitest';

import { log } from './log';

// B7.13: the scheduler summary line keeps its exact bytes through log.summary.
describe('log.summary (B7.13)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints [Tag] followed by the JSON payload, exactly as the old console.log did', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const payload = { timestamp: '2026-11-06T00:00:00.000Z', releases: { processed: 0 } };
    log.summary('Scheduler', payload);
    expect(spy).toHaveBeenCalledWith('[Scheduler]', JSON.stringify(payload));
    expect(spy.mock.calls[0].join(' ')).toBe(`[Scheduler] ${JSON.stringify(payload)}`);
  });

  it('prints the skipped line with its note in the same place as before', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log.summary('Scheduler', { reason: 'running' }, 'skipped: lease held');
    expect(spy.mock.calls[0].join(' ')).toBe(
      '[Scheduler] skipped: lease held {"reason":"running"}'
    );
  });
});
