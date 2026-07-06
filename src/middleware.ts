import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

// ─── Client IP resolution ───────────────────────────────────────────────────

/**
 * SECURITY / proxy topology — mirrors getClientIp() in src/lib/rate-limit.ts
 * (duplicated, not imported, to keep the Edge-runtime middleware free of that
 * module's Node timers). Prefer Cloudflare's unspoofable cf-connecting-ip, else
 * the rightmost (trusted-proxy-observed) X-Forwarded-For entry — never the
 * leftmost client-controlled value. Set TRUSTED_PROXY=cloudflare|railway to pin
 * the single correct source once the topology is confirmed.
 */
function getClientIpFromHeaders(request: NextRequest): string {
  const mode = process.env.TRUSTED_PROXY;
  const cf = request.headers.get('cf-connecting-ip')?.trim() || undefined;
  const realIp = request.headers.get('x-real-ip')?.trim() || undefined;

  const rightmostXff = (): string | undefined => {
    const forwarded = request.headers.get('x-forwarded-for');
    if (!forwarded) return undefined;
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : undefined;
  };

  if (mode === 'cloudflare') return cf || realIp || 'unknown';
  if (mode === 'railway') return rightmostXff() || realIp || 'unknown';
  return cf || rightmostXff() || realIp || 'unknown';
}

// ─── In-Memory Rate Limiter ─────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 300; // max requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

// Clean up stale entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now();
      rateLimitMap.forEach((value, key) => {
        if (now > value.resetTime) {
          rateLimitMap.delete(key);
        }
      });
    },
    5 * 60 * 1000
  );
}

// ─── Protected Routes ───────────────────────────────────────────────────────

const protectedRoutes = ['/dashboard', '/account', '/admin'];
const authRoutes = ['/login', '/register', '/forgot-password'];

const intlMiddleware = createIntlMiddleware(routing);

// ─── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let the health-check endpoint bypass all middleware logic so Railway
  // (or any orchestrator) always gets a fast, unobstructed response.
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Skip locale processing for API routes and static assets
  if (pathname.startsWith('/api')) {
    const ip = getClientIpFromHeaders(request);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.next();
  }

  // Canonical domain redirect: apex → www
  const host = request.headers.get('host') || '';
  if (host === 'renacleaning.co.uk') {
    const url = request.nextUrl.clone();
    url.host = 'www.renacleaning.co.uk';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // Strip locale prefix from pathname for auth checks
  const pathnameWithoutLocale = pathname.replace(/^\/en/, '') || '/';

  // Auth protection — validate the session via NextAuth's getToken, which
  // verifies the JWT and is aware of the `__Secure-`/`__Host-` cookie prefixes
  // and chunked (…session-token.0/.1) cookies. The previous raw check for two
  // literal cookie names misfired behind the proxy (wrong prefix / chunked
  // cookie → "no session" → spurious redirect to /login on valid sessions).
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;

  // Redirect unauthenticated users from protected routes
  const isProtectedRoute = protectedRoutes.some((route) => pathnameWithoutLocale.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth routes
  const isAuthRoute = authRoutes.some((route) => pathnameWithoutLocale.startsWith(route));

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Run next-intl middleware for locale detection and routing
  const response = intlMiddleware(request);

  // Rena Pro shell preview: ?shell=1 on an /app route persists a preview cookie so
  // James can view the (production shell-only) /app/* routes in a plain browser.
  // The native shell sends its own x-rena-shell header; this is the human bypass.
  // Low-risk: the /app data endpoints already require a CLEANER session, so this
  // only unlocks the chrome-free wrapper, not any data.
  if (
    pathnameWithoutLocale.startsWith('/app') &&
    request.nextUrl.searchParams.get('shell') === '1'
  ) {
    response.cookies.set('rena-app-preview', '1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      // Fonts are self-hosted via next/font (Newsreader/Jost) + a same-origin
      // @font-face (Etna) — no Google Fonts at runtime, so the CSP no longer
      // allows fonts.googleapis.com / fonts.gstatic.com. (The dev-only preview
      // script scripts/generate-cleaner-preview.ts pulls from Google, but it
      // renders static HTML offline and is never served by the app.)
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.sentry.io https://api.postcodes.io",
      'frame-src https://js.stripe.com https://hooks.stripe.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // Rate limiting for non-API page routes
  const ip = getClientIpFromHeaders(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|icons/|images/|fonts/|manifest\\.json|sw\\.js).*)',
  ],
};
