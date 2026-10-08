import { describe, expect, it, vi } from 'vitest';

// B5 UAT ruling (James, 2026-10-08): every native-handoff refusal writes one
// log line naming the app (or "browser") and the reason, and never the code.
// The refusals covered here never reach the database (browser, malformed,
// rate limited); the unknown, spent, account and role refusals are logged in
// the redeem and exercised against Postgres by H4, H5 and H7.
const { warn, all } = vi.hoisted(() => {
  process.env.NEXTAUTH_SECRET ||= 'unit-test-only-secret';
  const seen: unknown[][] = [];
  return { all: seen, warn: vi.fn((...a: unknown[]) => seen.push(a)) };
});
vi.mock('@/lib/log', () => ({
  log: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/db/prisma', () => ({ default: {}, prisma: {} }));

const { POST } = await import('./route');

const MALFORMED = 'this-is-not-a-handoff-code';

function call(headers: Record<string, string>, body: unknown, ip: string) {
  return POST(
    new Request('http://localhost/api/auth/native-handoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
      body: JSON.stringify(body),
    })
  );
}

function lastRefusal(): Record<string, unknown> {
  const c = warn.mock.calls.at(-1);
  expect(c?.[0]).toBe('native_handoff');
  expect(c?.[1]).toBe('refused');
  return c?.[2] as Record<string, unknown>;
}

describe('native-handoff refusals log once, never the code', () => {
  it('a browser refusal names "browser" and not_shell', async () => {
    warn.mockClear();
    const r = await call(
      { 'user-agent': 'Mozilla/5.0 Safari' },
      { code: MALFORMED },
      '198.51.100.1'
    );
    expect(r.status).toBe(400);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(lastRefusal()).toEqual({ app: 'browser', reason: 'not_shell' });
  });

  it.each([
    ['customer shell', { 'x-rena-shell': 'app-ios/1.0.1' }, 'CUSTOMER', '198.51.100.2'],
    ['Pro shell', { 'user-agent': 'Mozilla/5.0 RenaPro/1.0.3' }, 'PRO', '198.51.100.3'],
  ])('a malformed code from the %s names its app and malformed', async (_l, headers, app, ip) => {
    warn.mockClear();
    const r = await call(headers, { code: MALFORMED }, ip);
    expect(r.status).toBe(400);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(lastRefusal()).toEqual({ app, reason: 'malformed' });
  });

  it('a missing body is a malformed refusal too', async () => {
    warn.mockClear();
    const r = await POST(
      new Request('http://localhost/api/auth/native-handoff', {
        method: 'POST',
        headers: { 'x-rena-shell': 'app-ios/1.0.1', 'x-forwarded-for': '198.51.100.4' },
      })
    );
    expect(r.status).toBe(400);
    expect(lastRefusal()).toEqual({ app: 'CUSTOMER', reason: 'malformed' });
  });

  it('the rate limit refusal names the app and rate_limited', async () => {
    for (let i = 0; i < 10; i += 1) await call({}, { code: MALFORMED }, '198.51.100.5');
    warn.mockClear();
    const r = await call({}, { code: MALFORMED }, '198.51.100.5');
    expect(r.status).toBe(429);
    expect(lastRefusal()).toEqual({ app: 'browser', reason: 'rate_limited' });
  });

  it('no logged field ever carries the submitted code', () => {
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const c of all) expect(JSON.stringify(c)).not.toContain(MALFORMED);
  });
});
