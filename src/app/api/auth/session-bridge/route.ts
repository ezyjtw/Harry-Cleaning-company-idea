import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

import { verifyBearerToken } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';

// ─── Rena Pro auth bridge ────────────────────────────────────────────────────
//
// GET /api/auth/session-bridge?token=<bearer>&callbackUrl=/app/today
//
// The native shell logs in via POST /api/auth/login (→ a 30-day Bearer JWT held
// in the device Keychain). The wrapped portal + /app/* routes render inside the
// WebView and authenticate by the NextAuth *cookie* (getServerSession /
// getToken). This endpoint bridges the two: it verifies the Bearer JWT and mints
// an equivalent NextAuth session cookie, then redirects into the app — so the
// shell loads this URL once at login and the WebView lands authenticated for both
// the portal and /app/*.
//
// Security notes: the token travels as a query param (a GET the WebView can load
// and follow the redirect from), so it can appear in server logs — it is
// short-lived-in-use and already the secret the native app holds; the exchange is
// rate-limited. The minted cookie is HttpOnly + SameSite=Lax + Secure (in prod).

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
  const token = url.searchParams.get('token');
  // Only allow same-origin relative callbacks (never an open redirect).
  const rawCallback = url.searchParams.get('callbackUrl') || '/app/today';
  const callbackUrl = rawCallback.startsWith('/') ? rawCallback : '/app/today';

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const user = await verifyBearerToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
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
