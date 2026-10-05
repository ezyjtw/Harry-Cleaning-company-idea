import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// ─── TEMPORARY ANDROID STARTUP DIAGNOSTICS BEACON (James-ordered) ───────────
// The shells POST small JSON beacons here at each startup stage (JS entry
// with the expo-updates identity and its native log of the previous launch,
// boot, secure-store read, splash hidden, phase changes, shell mount, first
// WebView load, and any fatal caught by the global handler before death).
// Log-only: no storage, no auth, no effect on the app. REMOVED on James's word.
const MAX_BODY = 8192;

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
    // eslint-disable-next-line no-console
    console.log(
      `[boot-diag] ${JSON.stringify({ shell: request.headers.get('x-rena-shell'), body })}`
    );
  } catch {
    /* never fail the caller */
  }
  return new NextResponse(null, { status: 204 });
}
