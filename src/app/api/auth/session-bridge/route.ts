import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { encode, getToken } from 'next-auth/jwt';

import { verifyAndConsumeBridgeCode } from '@/lib/auth/session';
// TEMPORARY LOGIN DIAGNOSTICS (James-ordered) — removed in the fix commit.
import { loginDiag } from '@/lib/login-diag';
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

// Field incident (James-ordered): a failed bridge redemption must never show
// a customer raw JSON. The failure renders this honest page in the app's
// dress — one navy door to /login. In the shell, the pane's own /login watch
// bounces that navigation to the NATIVE login screen, which re-runs sign-in
// and mints a fresh bridge code; in a browser it is simply the login form.
// Server-side, so it reaches EVERY installed binary the day it deploys.
function bridgeFailurePage(status: number): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sign in again</title>
<style>
  :root{color-scheme:light}
  body{margin:0;background:#FAFBFC;font-family:Jost,-apple-system,'Segoe UI',Roboto,sans-serif;
       display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #E4E9F0;border-radius:16px;padding:40px 28px;
        max-width:360px;width:100%;text-align:center}
  .mark{font-weight:700;letter-spacing:.35em;color:#16296b;font-size:26px}
  h1{color:#16296b;font-size:20px;font-weight:600;margin:22px 0 8px}
  p{color:#3D5170;font-size:14px;font-weight:300;line-height:1.5;margin:0 0 24px}
  a.door{display:block;background:#16296b;color:#fff;text-decoration:none;border-radius:10px;
         padding:14px 0;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
  a.door:active{opacity:.9}
</style></head>
<body><main class="card">
  <div class="mark">RENA</div>
  <h1>Your sign-in link has expired</h1>
  <p>Tap below to sign in again.</p>
  <a class="door" href="/login">Sign in</a>
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Home-after-login root cause (James-read from the 13:03 window): behind
// Railway's proxy, `request.url` resolves to the server's own listen address,
// so `new URL(callbackUrl, url.origin)` produced
// `Location: https://localhost:<port>/app/today`. The device followed it into
// its own localhost and died instantly: NSURLErrorCannotConnectToHost (-1004,
// "Could not connect to the server"), identically for the native redemption
// (RN fetch "Network request failed") and the WebView fallback, on every login
// since the bridge was built. The Set-Cookie on the 307 still landed, which is
// why every OTHER pane worked and only the landing (the one pane that boots on
// the bridge) painted offline. A RELATIVE Location is resolved by the client
// against the public URL it actually requested, proxy-agnostic, the same
// pattern the Xero callback already documents. NextResponse.redirect() insists
// on an absolute URL, so the response is built by hand; cookies still attach.
function relativeRedirect(path: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });
}

function isSecureContext(): boolean {
  return (process.env.NEXTAUTH_URL || '').startsWith('https://');
}

function sessionCookieName(secure: boolean): string {
  return secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 'session-bridge', 20, 15 * 60 * 1000);
  if (!rl.ok) {
    const page = bridgeFailurePage(429);
    page.headers.set('Retry-After', String(rl.retryAfter));
    return page;
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
  if (rawCallback.startsWith('/') && !rawCallback.startsWith('//') && !rawCallback.includes('\\')) {
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

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Auth is not configured' }, { status: 500 });
  }

  const user = code ? await verifyAndConsumeBridgeCode(code) : null;
  if (!user) {
    // Field incident, tier 1 — the self-heal: the customer's first redemption
    // SUCCEEDED (307 + Set-Cookie), and what failed is a REPLAY of the spent
    // code (a WebView retry/reload of the bridge URL). That replay carries the
    // freshly-minted session cookie — so when a valid session is already on
    // the request, the honest answer is not an error page but the redirect the
    // spent code would have issued: forward to the (sanitised) callbackUrl.
    // No new access is granted; the session in hand is the only key used.
    const existing = await getToken({ req: request, secret });
    if (existing) {
      loginDiag('bridge', { outcome: 'replay-redirect', user: existing.sub ?? null, callbackUrl });
      return relativeRedirect(callbackUrl);
    }
    // Tier 2 — genuinely dead (expired before ever redeeming, cookie never
    // landed, or no code at all): the honest dressed page, never raw JSON.
    loginDiag('bridge', { outcome: 'dead', hadCode: !!code, status: code ? 401 : 400 });
    return bridgeFailurePage(code ? 401 : 400);
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
  loginDiag('bridge', {
    outcome: 'minted',
    user: user.id,
    role: user.role,
    cookie: sessionCookieName(secure),
    callbackUrl,
    shell: request.headers.get('x-rena-shell'),
  });
  const res = relativeRedirect(callbackUrl);
  res.cookies.set(sessionCookieName(secure), sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_S,
  });
  return res;
}
