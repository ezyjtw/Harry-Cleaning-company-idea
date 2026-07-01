import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { saveConnection } from '@/lib/services/xero.service';
import { makeXeroClient, xeroConfigured } from '@/lib/xero/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'xero_oauth_state';

// GET /api/admin/xero/callback — Xero redirects here after consent. Admin-only.
// Verifies the state cookie, exchanges the code for tokens, resolves the org
// (tenant), and stores the connection ENCRYPTED. No writes to Xero here.
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!xeroConfigured()) {
    return NextResponse.json({ error: 'Xero is not configured.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const returnedState = url.searchParams.get('state');
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  const oauthError = url.searchParams.get('error');

  // Onward redirect uses a RELATIVE Location + 303. Behind Railway's proxy,
  // `request.url` (and thus `url.origin`) can resolve to the internal
  // http://localhost:PORT, making the final hop a "localhost refused to connect".
  // A relative Location sidesteps this: the browser resolves it against the
  // PUBLIC callback URL it actually navigated to, yielding the correct origin —
  // proxy-agnostic, no url.origin dependence. NextResponse.redirect() insists on
  // an absolute URL, so we build the response by hand.
  const redirectTo = (params: string) =>
    new NextResponse(null, {
      status: 303,
      headers: { Location: `/admin/xero?${params}` },
    });

  if (oauthError) {
    return redirectTo(`error=${encodeURIComponent(oauthError)}`);
  }
  // CSRF: the state we set must match what Xero echoed back.
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return redirectTo('error=state_mismatch');
  }

  try {
    const client = makeXeroClient(cookieState);
    const tokenSet = await client.apiCallback(request.url);
    await client.updateTenants(false);
    const tenant = client.tenants?.[0];
    if (!tenant?.tenantId) {
      return redirectTo('error=no_org');
    }
    await saveConnection(
      tokenSet,
      { tenantId: tenant.tenantId, tenantName: tenant.tenantName },
      admin.id
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[xero] callback failed:', err);
    return redirectTo('error=connect_failed');
  }

  const res = redirectTo('connected=1');
  res.cookies.delete(STATE_COOKIE);
  return res;
}
