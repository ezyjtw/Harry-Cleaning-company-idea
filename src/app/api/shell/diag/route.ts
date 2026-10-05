import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loginDiag } from '@/lib/login-diag';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// ─── TEMPORARY LOGIN DIAGNOSTICS BEACON (James-ordered, 2026-10-05) ─────────
// The native shells and the shell-gated pages POST small JSON beacons here
// during the login window (pane, error code/description reaching onError or
// onHttpError, whether the bridge had completed, witness ages). It only logs
// — no storage, no auth, no effect on the app. REMOVED in the fix commit.
const MAX_BODY = 4096;

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`shell-diag:${getClientIp(request)}`, 300, 60 * 1000);
  if (!rl.allowed) return new NextResponse(null, { status: 204 });
  try {
    const text = (await request.text()).slice(0, MAX_BODY);
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* log the raw text */
    }
    loginDiag('beacon', {
      shell: request.headers.get('x-rena-shell'),
      ua: (request.headers.get('user-agent') || '').match(/Rena(Pro|App)\/[\w.]+/)?.[0] ?? null,
      body,
    });
  } catch {
    /* never fail the caller */
  }
  return new NextResponse(null, { status: 204 });
}
