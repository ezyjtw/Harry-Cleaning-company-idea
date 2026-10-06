import { describe, expect, it } from 'vitest';

import { canonicalOrigin, csrfVerdict, hasSessionCookie, isCsrfExemptPath } from './csrf';

// RENA-006 (B1a): the cross-site rule matrix in James's ordered precedence.
const CANONICAL = 'https://www.renacleaning.co.uk';
const COOKIE = ['__Secure-next-auth.session-token'];
const CHUNKED = ['__Secure-next-auth.session-token.0', '__Secure-next-auth.session-token.1'];

function h(headers: Record<string, string>): { get(name: string): string | null } {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

function verdict(input: {
  method?: string;
  pathname?: string;
  headers?: Record<string, string>;
  cookies?: string[];
  canonical?: string | null;
}) {
  return csrfVerdict({
    method: input.method ?? 'POST',
    pathname: input.pathname ?? '/api/bookings/abc/cancel',
    headers: h(input.headers ?? {}),
    cookieNames: input.cookies ?? COOKIE,
    canonical: input.canonical === undefined ? CANONICAL : input.canonical,
  });
}

describe('canonicalOrigin', () => {
  it('reduces NEXTAUTH_URL to scheme, host and port', () => {
    expect(canonicalOrigin('https://www.renacleaning.co.uk/en')).toBe(CANONICAL);
    expect(canonicalOrigin('http://localhost:3001')).toBe('http://localhost:3001');
    expect(canonicalOrigin(undefined)).toBeNull();
    expect(canonicalOrigin('nonsense')).toBeNull();
  });
});

describe('precedence 1: safe methods', () => {
  it('never checks GET, HEAD or OPTIONS, even with a foreign Origin and a cookie', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(verdict({ method, headers: { origin: 'https://evil.example' } })).toEqual({
        ok: true,
        reason: 'safe-method',
      });
    }
  });
});

describe('precedence 2 and 3: exemptions', () => {
  it('exempts webhooks and cron, which carry their own security', () => {
    expect(isCsrfExemptPath('/api/webhooks/stripe')).toBe(true);
    expect(isCsrfExemptPath('/api/cron/run-jobs')).toBe(true);
    expect(
      verdict({ pathname: '/api/webhooks/stripe', headers: { origin: 'https://evil.example' } }).ok
    ).toBe(true);
  });
  it("exempts only NextAuth's protocol routes, never Rena's routes under /api/auth", () => {
    for (const p of [
      '/api/auth/session',
      '/api/auth/csrf',
      '/api/auth/providers',
      '/api/auth/signin',
      '/api/auth/signin/credentials',
      '/api/auth/signout',
      '/api/auth/callback/credentials',
      '/api/auth/_log',
    ]) {
      expect(isCsrfExemptPath(p)).toBe(true);
    }
    for (const p of [
      '/api/auth/login',
      '/api/auth/signup',
      '/api/auth/session-bridge',
      '/api/auth/shell-logout',
      '/api/auth/sign-out-all',
      '/api/auth/change-password',
      '/api/auth/profile',
      '/api/auth/forgot-password',
    ]) {
      expect(isCsrfExemptPath(p)).toBe(false);
      expect(verdict({ pathname: p, headers: { origin: 'https://evil.example' } })).toEqual({
        ok: false,
        reason: 'origin-mismatch',
      });
    }
  });
});

describe('precedence 4: bypass headers are a signal, not authentication', () => {
  it('passes the layer on Authorization or x-rena-shell even with a cookie and a foreign Origin', () => {
    expect(
      verdict({ headers: { authorization: 'Bearer x', origin: 'https://evil.example' } })
    ).toEqual({
      ok: true,
      reason: 'bypass-header',
    });
    expect(verdict({ headers: { 'x-rena-shell': 'pro-ios/1.0.3' } })).toEqual({
      ok: true,
      reason: 'bypass-header',
    });
  });
});

describe('precedence 5: cookie-authenticated mutations prove their origin', () => {
  it('passes with no session cookie at all (guest booking, leads, native login)', () => {
    expect(
      verdict({
        cookies: ['rena-customer-preview', '_ga'],
        headers: { origin: 'https://evil.example' },
      })
    ).toEqual({
      ok: true,
      reason: 'no-cookie',
    });
  });
  it('detects both cookie prefixes and chunked cookies', () => {
    expect(hasSessionCookie(COOKIE)).toBe(true);
    expect(hasSessionCookie(CHUNKED)).toBe(true);
    expect(hasSessionCookie(['next-auth.session-token'])).toBe(true);
    expect(hasSessionCookie(['next-auth.csrf-token', '__Host-next-auth.csrf-token'])).toBe(false);
  });
  it('requires exact Origin equality: scheme, host and port', () => {
    expect(verdict({ headers: { origin: CANONICAL } })).toEqual({ ok: true, reason: 'origin' });
    for (const origin of [
      'http://www.renacleaning.co.uk',
      'https://renacleaning.co.uk',
      'https://www.renacleaning.co.uk:8443',
      'https://www.renacleaning.co.uk.evil.example',
      'https://evil.example',
      'null',
      'garbage',
    ]) {
      expect(verdict({ headers: { origin } })).toEqual({ ok: false, reason: 'origin-mismatch' });
    }
  });
  it('Origin wins over Sec-Fetch-Site when both are present', () => {
    expect(
      verdict({ headers: { origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' } }).ok
    ).toBe(false);
  });
  it('without Origin, Sec-Fetch-Site same-origin or none passes and same-site never does', () => {
    expect(verdict({ headers: { 'sec-fetch-site': 'same-origin' } })).toEqual({
      ok: true,
      reason: 'fetch-site',
    });
    expect(verdict({ headers: { 'sec-fetch-site': 'none' } })).toEqual({
      ok: true,
      reason: 'fetch-site',
    });
    expect(verdict({ headers: { 'sec-fetch-site': 'same-site' } })).toEqual({
      ok: false,
      reason: 'no-origin-proof',
    });
    expect(verdict({ headers: { 'sec-fetch-site': 'cross-site' } })).toEqual({
      ok: false,
      reason: 'no-origin-proof',
    });
    expect(verdict({ headers: {} })).toEqual({ ok: false, reason: 'no-origin-proof' });
  });
  it('refuses when the canonical origin is unknown and an Origin is present', () => {
    expect(verdict({ canonical: null, headers: { origin: CANONICAL } }).ok).toBe(false);
  });
});
