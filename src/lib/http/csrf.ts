// RENA-006 (B1a, James-ruled 2026-10-06): the cross-site request rule for the
// API, evaluated in the middleware's API branch. Pure and Edge-safe. The
// precedence is ORDERED and fixed:
//   1. GET, HEAD and OPTIONS are never checked.
//   2. Webhooks and cron keep their own signature or secret security.
//   3. NextAuth's own protocol routes keep NextAuth's double-submit token.
//      Rena's routes under /api/auth (login, bridge, shell-logout,
//      sign-out-all, change-password and the rest) are NOT exempt.
//   4. An Authorization or x-rena-shell header passes this layer. It is a
//      bypass SIGNAL only (a cross-site page cannot add either header
//      without a CORS preflight, which this app never grants); it is never
//      authentication, which the route decides on its own.
//   5. A mutation that carries a session cookie must prove its origin: when
//      an Origin header is present it must equal NEXTAUTH_URL's origin
//      exactly (scheme, host and port); without Origin, Sec-Fetch-Site must
//      be same-origin or none. same-site is never enough.
//   6. Everything else is refused with 403.
// A mutation with no session cookie is not cookie-authenticated and is left
// to the route (guest booking, leads, contact, the native login itself).

export type CsrfVerdict =
  | {
      ok: true;
      reason: 'safe-method' | 'exempt' | 'bypass-header' | 'no-cookie' | 'origin' | 'fetch-site';
    }
  | { ok: false; reason: 'origin-mismatch' | 'no-origin-proof' };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PREFIXES = ['/api/webhooks/', '/api/cron/'];

// NextAuth's protocol surface under /api/auth, nothing else.
const NEXTAUTH_PROTOCOL = new Set([
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/error',
  '/api/auth/_log',
]);
const NEXTAUTH_PROTOCOL_PREFIXES = [
  '/api/auth/signin/',
  '/api/auth/callback/',
  '/api/auth/callback',
];

export const SESSION_COOKIE_PREFIXES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

export function isCsrfExemptPath(pathname: string): boolean {
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (NEXTAUTH_PROTOCOL.has(pathname)) return true;
  return NEXTAUTH_PROTOCOL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/** True when any NextAuth session cookie (either prefix, chunked or not) is present. */
export function hasSessionCookie(cookieNames: readonly string[]): boolean {
  for (const name of cookieNames) {
    if (SESSION_COOKIE_PREFIXES.some((p) => name === p || name.startsWith(`${p}.`))) return true;
  }
  return false;
}

/** The canonical origin (scheme://host[:port]) from NEXTAUTH_URL, or null when unset or malformed. */
export function canonicalOrigin(nextAuthUrl: string | undefined): string | null {
  if (!nextAuthUrl) return null;
  try {
    return new URL(nextAuthUrl).origin;
  } catch {
    return null;
  }
}

export interface CsrfInput {
  method: string;
  pathname: string;
  headers: { get(name: string): string | null };
  cookieNames: readonly string[];
  canonical: string | null;
}

export function csrfVerdict(input: CsrfInput): CsrfVerdict {
  const method = input.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return { ok: true, reason: 'safe-method' };
  if (isCsrfExemptPath(input.pathname)) return { ok: true, reason: 'exempt' };
  if (input.headers.get('authorization') || input.headers.get('x-rena-shell')) {
    return { ok: true, reason: 'bypass-header' };
  }
  if (!hasSessionCookie(input.cookieNames)) return { ok: true, reason: 'no-cookie' };

  const origin = input.headers.get('origin');
  if (origin !== null && origin !== '') {
    let parsed: string | null = null;
    try {
      parsed = new URL(origin).origin;
    } catch {
      parsed = null;
    }
    if (input.canonical && parsed === input.canonical) return { ok: true, reason: 'origin' };
    return { ok: false, reason: 'origin-mismatch' };
  }
  const fetchSite = input.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin' || fetchSite === 'none')
    return { ok: true, reason: 'fetch-site' };
  return { ok: false, reason: 'no-origin-proof' };
}
