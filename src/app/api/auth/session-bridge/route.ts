import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

import { verifyAndConsumeBridgeCode } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';

// ─── Rena Pro auth bridge ────────────────────────────────────────────────────
//
// GET /api/auth/session-bridge?code=<bridgeCode>&callbackUrl=/app/today
//
// The native shell logs in via POST /api/auth/login, which returns (a) a 30-day
// Bearer JWT held in the device Keychain for native API calls, and (b) a
// single-use, 60-second `bridgeCode`. The wrapped portal + /app/* render inside
// the WebView and authenticate by the NextAuth *cookie*. This endpoint bridges
// the two: it consumes the bridgeCode (once) and mints an equivalent NextAuth
// session cookie, then redirects into the app — so the shell loads this URL once
// at login and the WebView lands authenticated for both the portal and /app/*.
//
// Security: only the short-lived single-use `code` is accepted — the long-lived
// Bearer is NEVER put in a URL. A code appearing in a redirect/log is spent and
// expired within 60s. Rate-limited; the minted cookie is HttpOnly + SameSite=Lax
// + Secure (in prod); the callback is restricted to same-origin relative paths.

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

function isSecureContext(): boolean {
  return (process.env.NEXTAUTH_URL || '').startsWith('https://');
}

function sessionCookieName(secure: boolean): string {
  return secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 'session-bridge', 20, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // SECURITY (S2): only a same-origin RELATIVE callback is honoured. A bare
  // startsWith('/') check admits protocol-relative '//evil.com' (and backslash
  // variants '/\evil.com' that browsers normalise to '//') — an open redirect on
  // an auth endpoint. Reject '//' and any backslash outright, then resolve and
  // require the resolved origin to equal ours. Any failure falls back to
  // /app/today — never an error, never an off-site redirect.
  const rawCallback = url.searchParams.get('callbackUrl') || '/app/today';
  let callbackUrl = '/app/today';
  if (
    rawCallback.startsWith('/') &&
    !rawCallback.startsWith('//') &&
    !rawCallback.includes('\\')
  ) {
    try {
      const resolved = new URL(rawCallback, url.origin);
      if (resolved.origin === url.origin) {
        callbackUrl = resolved.pathname + resolved.search + resolved.hash;
      }
    } catch {
      // keep the safe default
    }
  }

  // Refuse a long-lived Bearer outright — only the single-use code is accepted.
  if (url.searchParams.get('token') || request.headers.get('authorization')) {
    return NextResponse.json(
      { error: 'This endpoint accepts only a single-use bridge code, not a token.' },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  const user = await verifyAndConsumeBridgeCode(code);
  if (!user) {
    return NextResponse.json({ error: 'Invalid, expired, or already-used code' }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Auth is not configured' }, { status: 500 });
  }

  // Mint a NextAuth-compatible session token. The claims mirror what the jwt()
  // callback sets (id + role) plus the standard sub/name/email, so getServerSession
  // and getToken resolve the same user the portal expects.
  const sessionToken = await encode({
    token: {
      id: user.id,
      sub: user.id,
      role: user.role as 'CLIENT' | 'CLEANER' | 'ADMIN',
      name: user.name,
      email: user.email,
    },
    secret,
    maxAge: THIRTY_DAYS_S,
  });

  const secure = isSecureContext();
  const res = NextResponse.redirect(new URL(callbackUrl, url.origin));
  res.cookies.set(sessionCookieName(secure), sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_S,
  });
  return res;
}
