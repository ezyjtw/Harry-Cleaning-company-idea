import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '../../middleware';

import { enforcedPolicy, isPublicStaticPath, reportOnlyPolicy } from './csp';
import { parseCspReports } from './csp-report';

// RENA-005 (B6.1): the policy per route class, the report parser and the
// report route. next-intl and getToken are stubbed as in middleware.test.ts.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));
vi.mock('@/i18n/routing', () => ({ routing: {} }));
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));

vi.hoisted(() => {
  process.env.NEXTAUTH_URL = 'https://www.renacleaning.co.uk';
  process.env.NEXTAUTH_SECRET = 'test-secret';
});


const get = (path: string) =>
  middleware(new NextRequest(`https://www.renacleaning.co.uk${path}`, { method: 'GET' }));

describe('CSP step one: the enforced policy', () => {
  it("production drops 'unsafe-eval'; development keeps it", () => {
    expect(enforcedPolicy(true)).not.toContain("'unsafe-eval'");
    expect(enforcedPolicy(false)).toContain("'unsafe-eval'");
  });

  it('every policy forbids framing and reports to /api/csp-report', () => {
    for (const p of [enforcedPolicy(true), enforcedPolicy(false), reportOnlyPolicy('n')]) {
      expect(p).toContain("frame-ancestors 'none'");
      expect(p).toContain('report-uri /api/csp-report');
      expect(p).toContain('report-to csp-endpoint');
    }
  });

  it('the report-only twin is the nonce policy with no unsafe-inline script', () => {
    const p = reportOnlyPolicy('abc');
    expect(p).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic' https://js.stripe.com");
    expect(p.split('; ').find((d) => d.startsWith('script-src'))).not.toContain('unsafe-inline');
  });
});

describe('CSP headers per route class (middleware)', () => {
  beforeEach(() => {
    vi.mocked(getToken).mockResolvedValue(null);
  });

  it('a public static page: enforced policy, reporting endpoint, no report-only twin, no nonce', async () => {
    for (const path of ['/', '/pricing', '/cleaning/chingford', '/cleaning/walthamstow']) {
      expect(isPublicStaticPath(path)).toBe(true);
      const res = await get(path);
      expect(res.headers.get('content-security-policy')).toBe(enforcedPolicy(false));
      expect(res.headers.get('reporting-endpoints')).toBe('csp-endpoint="/api/csp-report"');
      expect(res.headers.get('content-security-policy-report-only')).toBeNull();
      expect(res.headers.get('x-middleware-request-x-nonce')).toBeNull();
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    }
  });

  it('an authed page: the report-only nonce twin, its nonce forwarded to the render', async () => {
    vi.mocked(getToken).mockResolvedValue({ role: 'CUSTOMER' } as never);
    const res = await get('/account');
    expect(res.status).toBe(200);
    const ro = res.headers.get('content-security-policy-report-only');
    const nonce = res.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(ro).toBe(reportOnlyPolicy(nonce as string));
    expect(res.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(ro);
    const overrides = (res.headers.get('x-middleware-override-headers') ?? '').split(',');
    expect(overrides).toEqual(
      expect.arrayContaining(['x-nonce', 'content-security-policy-report-only'])
    );
    // A second request gets a fresh nonce.
    const again = await get('/account');
    expect(again.headers.get('x-middleware-request-x-nonce')).not.toBe(nonce);
  });

  it('the auth pages are dynamic: they get the twin too', async () => {
    expect(isPublicStaticPath('/login')).toBe(false);
    const res = await get('/login');
    expect(res.headers.get('content-security-policy-report-only')).not.toBeNull();
  });

  it('an API response and a redirect carry no page policy', async () => {
    const api = await get('/api/pricing/services');
    expect(api.headers.get('content-security-policy')).toBeNull();
    const redirect = await get('/account');
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get('content-security-policy')).toBeNull();
  });
});

describe('CSP report parsing', () => {
  it('report-uri format: the path, the directive and the host only', () => {
    const v = parseCspReports('application/csp-report', {
      'csp-report': {
        'document-uri': 'https://www.renacleaning.co.uk/account?token=secret#x',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?q=1',
        'script-sample': 'alert(document.cookie)',
      },
    });
    expect(v).toEqual([
      { documentPath: '/account', directive: 'script-src-elem', blockedHost: 'evil.example' },
    ]);
    expect(JSON.stringify(v)).not.toMatch(/secret|q=1|cookie/);
  });

  it('Reporting API format: csp-violation entries only', () => {
    const v = parseCspReports('application/reports+json', [
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://www.renacleaning.co.uk/app/jobs?x=1',
          effectiveDirective: 'script-src',
          blockedURL: 'inline',
        },
      },
      { type: 'deprecation', body: { id: 'x' } },
    ]);
    expect(v).toEqual([
      { documentPath: '/app/jobs', directive: 'script-src', blockedHost: 'inline' },
    ]);
  });

  it('an unknown shape gives nothing', () => {
    expect(parseCspReports('application/json', { a: 1 })).toEqual([]);
    expect(parseCspReports('application/reports+json', { a: 1 })).toEqual([]);
  });
});

describe('POST /api/csp-report', () => {
  it('answers 204, logs only allowlisted fields, and rate limits at 60 a minute per IP', async () => {
    const { log } = await import('@/lib/log');
    const warn = vi.spyOn(log, 'warn');
    const { POST } = await import('../../app/api/csp-report/route');
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://www.renacleaning.co.uk/account?t=1',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example/a.js',
      },
    });
    const send = () =>
      POST(
        new Request('https://www.renacleaning.co.uk/api/csp-report', {
          method: 'POST',
          headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': '203.0.113.9' },
          body,
        })
      );
    const first = await send();
    expect(first.status).toBe(204);
    expect(warn).toHaveBeenCalledWith('csp', 'violation', {
      route: '/account',
      directive: 'script-src',
      blockedHost: 'evil.example',
    });
    for (let i = 0; i < 59; i += 1) await send();
    warn.mockClear();
    const over = await send();
    expect(over.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
