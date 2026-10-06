import { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-074: the bridge-minted cookie carries pwdAt, sid and sv, and its life is
// capped by the WEB row's expiry (hierarchy law). RENA-003: a failed
// redemption with no live cookie is the dressed page, never JSON.
const verifyAndConsumeBridgeCode = vi.fn();
const getToken = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  verifyAndConsumeBridgeCode: (...a: unknown[]) => verifyAndConsumeBridgeCode(...a),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock('next-auth/jwt', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getToken: (...a: unknown[]) => getToken(...a) };
});

vi.hoisted(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-bridge';
  process.env.NEXTAUTH_URL = 'https://www.renacleaning.co.uk';
});

import { GET } from './route';

function get(query: string): NextRequest {
  return new NextRequest(`https://www.renacleaning.co.uk/api/auth/session-bridge${query}`);
}

describe('GET /api/auth/session-bridge', () => {
  beforeEach(() => {
    verifyAndConsumeBridgeCode.mockReset();
    getToken.mockReset().mockResolvedValue(null);
  });

  it('mints a cookie carrying pwdAt, sid and sv, capped by the row expiry', async () => {
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // parent has two days left
    verifyAndConsumeBridgeCode.mockResolvedValue({
      user: { id: 'u1', email: 'x@example.test', name: 'X', role: 'CLEANER', sessionJti: 'web-1' },
      webJti: 'web-1',
      expiresAt,
      sv: 2,
    });
    const res = await GET(get('?code=abc&callbackUrl=/app/today'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/app/today');
    const setCookie = res.headers.get('set-cookie') ?? '';
    const match = /__Secure-next-auth\.session-token=([^;]+)/.exec(setCookie);
    if (!match) throw new Error('session cookie expected');
    const maxAge = Number(/Max-Age=(\d+)/.exec(setCookie)?.[1]);
    expect(maxAge).toBeLessThanOrEqual(2 * 24 * 60 * 60);
    expect(maxAge).toBeGreaterThan(2 * 24 * 60 * 60 - 60);
    const token = await decode({
      token: decodeURIComponent(match[1]),
      secret: 'test-secret-for-bridge',
    });
    expect(token?.sid).toBe('web-1');
    expect(token?.sv).toBe(2);
    expect(typeof token?.pwdAt).toBe('number');
    expect(token?.id).toBe('u1');
    expect(token?.role).toBe('CLEANER');
  });

  it('answers the dressed page on a dead code with no live cookie', async () => {
    verifyAndConsumeBridgeCode.mockResolvedValue(null);
    const res = await GET(get('?code=spent'));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('self-heals a spent-code replay when a session cookie is already present', async () => {
    verifyAndConsumeBridgeCode.mockResolvedValue(null);
    getToken.mockResolvedValue({ id: 'u1' });
    const res = await GET(get('?code=spent&callbackUrl=/app/home'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/app/home');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a Bearer in the query or header outright', async () => {
    const res = await GET(get('?token=bearer'));
    expect(res.status).toBe(400);
    expect(verifyAndConsumeBridgeCode).not.toHaveBeenCalled();
  });
});
