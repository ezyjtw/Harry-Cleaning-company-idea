import { NextResponse } from 'next/server';

import { redeemNativeHandoffCode } from '@/lib/auth/native-handoff';
import { log } from '@/lib/log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { SHELL_HEADER, isCustomerShell, isRenaShell } from '@/lib/shell';

// RENA-031/082 (B5): the shell redeems the signup or join handoff code here,
// by native fetch. Only this response ever carries the Bearer and the bridge
// code; the shell stores them in SecureStore and bridges exactly as login
// does. The shell signature decides which app the code must have been minted
// for (a Pro code cannot be redeemed by the customer app or a browser); the
// code is the credential.

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

// B5 UAT ruling (James, 2026-10-08): every refusal writes one log line naming
// the app (or "browser") and the reason; the code never enters a log. The
// refusals inside the redeem are logged there.
export async function POST(request: Request) {
  const app = isRenaShell(request.headers)
    ? 'PRO'
    : isCustomerShell(request.headers)
      ? 'CUSTOMER'
      : null;
  const ip = getClientIp(request);
  const rl = checkRateLimit(`native-handoff:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!rl.allowed) {
    log.warn('native_handoff', 'refused', { app: app ?? 'browser', reason: 'rate_limited' });
    return NextResponse.json(
      { error: 'Too many attempts. Please sign in instead.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  if (!app) {
    log.warn('native_handoff', 'refused', { app: 'browser', reason: 'not_shell' });
    return NextResponse.json({ error: 'Not available here.' }, { status: 400 });
  }

  let code: unknown = null;
  try {
    code = ((await request.json()) as { code?: unknown })?.code;
  } catch {
    code = null;
  }

  const r = await redeemNativeHandoffCode(code, app, {
    label: request.headers.get(SHELL_HEADER),
  });
  if (!r.ok) {
    // One answer for every refusal: the shell falls back to native login.
    return NextResponse.json(
      { error: 'This sign-in link has expired. Please sign in.' },
      { status: 400 }
    );
  }
  return NextResponse.json({ token: r.token, bridgeCode: r.bridgeCode }, { status: 200 });
}
