import { test, expect } from '@playwright/test';

// RENA-061: the health probe must run SELECT 1 on every call. A statically
// cached handler would answer a frozen 200 forever, which the rig caught once;
// two calls must therefore carry different timestamps and no cache header.
test.describe('Health probe', () => {
  test('answers live on every call', async ({ request }) => {
    const first = await request.get('/api/health');
    expect(first.status()).toBe(200);
    expect(first.headers()['cache-control']).toContain('no-store');
    const a = (await first.json()) as { status: string; database: string; timestamp: string };
    expect(a.status).toBe('ok');
    expect(a.database).toBe('connected');

    await new Promise((r) => setTimeout(r, 1100));
    const second = await request.get('/api/health');
    const b = (await second.json()) as { timestamp: string };
    expect(b.timestamp).not.toBe(a.timestamp);
  });
});
