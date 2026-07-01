import { randomBytes } from 'crypto';

import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { makeXeroClient, xeroConfigured } from '@/lib/xero/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'xero_oauth_state';

// GET /api/admin/xero/connect — admin-only. Redirects the admin to Xero's consent
// screen. A random `state` is stored in an httpOnly cookie and echoed back by
// Xero, then verified in the callback (CSRF protection).
export async function GET() {
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
