import { randomBytes } from 'crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { makeXeroClient, xeroConfigured } from '@/lib/xero/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'xero_oauth_state';

// GET /api/admin/xero/connect — admin-only. Redirects the admin to Xero's consent
// screen. A random `state` is stored in an httpOnly cookie and echoed back by
// Xero, then verified in the callback (CSRF protection).
//
// GET /api/admin/xero/connect?debug=1 — admin-only. Instead of redirecting,
// returns the EXACT authorize URL + parsed params (client_id, redirect_uri,
// scope, response_type) the running code emits. Ground truth for diagnosing
// invalid_scope — no client_secret is ever in the URL, so this is safe to view.
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!xeroConfigured()) {
    return NextResponse.json(
      { error: 'Xero is not configured (missing XERO_CLIENT_ID/SECRET/REDIRECT_URI).' },
      { status: 503 }
    );
  }

  const state = randomBytes(16).toString('hex');
  const client = makeXeroClient(state);
  const consentUrl = await client.buildConsentUrl();

  // Parse what we actually emit and log it (Railway logs).
  const parsed = new URL(consentUrl);
  const emitted = {
    authorizeHost: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
    response_type: parsed.searchParams.get('response_type'),
    client_id: parsed.searchParams.get('client_id'),
    redirect_uri: parsed.searchParams.get('redirect_uri'),
    scope: parsed.searchParams.get('scope'),
    hasState: !!parsed.searchParams.get('state'),
  };
  // eslint-disable-next-line no-console
  console.log('[xero] consent URL emitted:', JSON.stringify(emitted));

  if (request.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({ emitted, fullUrl: consentUrl });
  }

  const res = NextResponse.redirect(consentUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes to complete the flow
  });
  return res;
}
