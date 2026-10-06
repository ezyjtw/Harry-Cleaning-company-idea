import { NextResponse } from 'next/server';

// ─── Shell logout: end the WEB session ──────────────────────────────────────
//
// Session lifecycle (James-ruled, Home-after-login): every native shell
// logout path must end the WebView session too. Until now only the web
// account menu's signOut() expired the NextAuth cookie — the shell's own
// paths (lock screen "switch account", password re-login, session-lost)
// deleted the Keychain bearer and left the previous account's session cookie
// in the shared jar. The shell POSTs here natively on every logout; the
// response expires every session-cookie name NextAuth may have minted (both
// prefixes, plus the chunked variants), path '/', so the shared jar (iOS
// NSHTTPCookieStorage via the native fetch, Android CookieManager, which the
// WebView reads directly) drops it. No body, no auth needed: this only ever
// deletes, and deleting a cookie the caller already holds grants nothing.
const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  '__Secure-next-auth.session-token.0',
  '__Secure-next-auth.session-token.1',
  'next-auth.session-token',
  'next-auth.session-token.0',
  'next-auth.session-token.1',
];

export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, '', {
      httpOnly: true,
      secure: name.startsWith('__Secure-'),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
