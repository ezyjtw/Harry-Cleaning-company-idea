import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-006 (B1a): the rule is wired into the API branch, and no CORS grant
// ever escapes the middleware for an arbitrary origin (regression test ruled
// by James). next-intl and getToken are stubbed; page routes are not under
// test here.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));
vi.mock('@/i18n/routing', () => ({ routing: {} }));
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));

vi.hoisted(() => {
  process.env.NEXTAUTH_URL = 'https://www.renacleaning.co.uk';
  process.env.NEXTAUTH_SECRET = 'test-secret';
});

import { middleware } from './middleware';

function req(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  cookie?: string
): NextRequest {
  const h = new Headers(headers);
  if (cookie) h.set('cookie', cookie);
  return new NextRequest(`https://www.renacleaning.co.uk${path}`, { method, headers: h });
}

const SESSION = '__Secure-next-auth.session-token=abc';

describe('middleware API branch: cross-site rule (RENA-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses a cookie-authenticated POST from a foreign Origin with 403 JSON', async () => {
    const res = await middleware(
      req('POST', '/api/bookings/x/cancel', { origin: 'https://evil.example' }, SESSION)
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Cross-site request refused.' });
  });

  it("covers Rena's own routes under /api/auth, not only the rest of the API", async () => {
    const res = await middleware(
      req('POST', '/api/auth/sign-out-all', { origin: 'https://evil.example' }, SESSION)
    );
    expect(res.status).toBe(403);
  });

  it('passes a same-origin cookie-authenticated POST', async () => {
    const res = await middleware(
      req('POST', '/api/bookings/x/cancel', { origin: 'https://www.renacleaning.co.uk' }, SESSION)
    );
    expect(res.status).toBe(200);
  });

  it('passes a shell request on its header alone, with the cookie and no Origin', async () => {
    const res = await middleware(
      req('POST', '/api/auth/shell-logout', { 'x-rena-shell': 'pro-ios/1.0.3' }, SESSION)
    );
    expect(res.status).toBe(200);
  });

  it('passes a Bearer request without any cookie or Origin', async () => {
    const res = await middleware(
      req('POST', '/api/push/expo/register', { authorization: 'Bearer t' })
    );
    expect(res.status).toBe(200);
  });

  it('leaves GET alone and never grants CORS to an arbitrary origin on a preflight', async () => {
    const get = await middleware(
      req('GET', '/api/cleaner/badges', { origin: 'https://evil.example' }, SESSION)
    );
    expect(get.status).toBe(200);
    const preflight = await middleware(
      req('OPTIONS', '/api/bookings/x/cancel', {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-rena-shell, authorization',
      })
    );
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect(preflight.headers.get('access-control-allow-headers')).toBeNull();
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('keeps the authed-API no-store header on a passing request', async () => {
    const res = await middleware(
      req('POST', '/api/messages', { 'sec-fetch-site': 'same-origin' }, SESSION)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('marks the personal API routes outside the authed family no-store (RENA-048)', async () => {
    for (const path of [
      '/api/cleaners',
      '/api/cleaners/abc',
      '/api/job-check',
      '/api/unsubscribe',
    ]) {
      const res = await middleware(req('GET', path));
      expect(res.headers.get('cache-control'), path).toBe('private, no-store');
    }
    // A sibling prefix is not swept in by accident.
    const pricing = await middleware(req('GET', '/api/pricing/services'));
    expect(pricing.headers.get('cache-control')).toBeNull();
  });
});
