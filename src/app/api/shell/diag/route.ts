import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { log } from '@/lib/log';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// ─── TEMPORARY ANDROID STARTUP DIAGNOSTICS BEACON (James-ordered) ───────────
// The shells POST small JSON beacons here at each startup stage (JS entry
// with the expo-updates identity and its native log of the previous launch,
// boot, secure-store read, splash hidden, phase changes, shell mount, first
// WebView load, and any fatal caught by the global handler before death).
// Log-only: no storage, no auth, no effect on the app. REMOVED on James's word.
const MAX_BODY = 8192;

// The sanctioned beacon fields: app, stage, phase, pane and code as short
// strings, ms as a number. Anything else is counted, never logged.
const BEACON_STRINGS = ['app', 'stage', 'phase', 'pane', 'code'] as const;
function pickBeaconFields(body: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  const b = body as Record<string, unknown>;
  for (const key of BEACON_STRINGS) {
    const v = b[key];
    if (typeof v === 'string' && v.length <= 40) out[key] = v;
    else if (key === 'code' && typeof v === 'number') out[key] = v;
  }
  if (typeof b.ms === 'number' && Number.isFinite(b.ms)) out.ms = Math.round(b.ms);
  const known = new Set<string>([...BEACON_STRINGS, 'ms']);
  const extra = Object.keys(b).filter((k) => !known.has(k)).length;
  if (extra) out.droppedCount = extra;
  return out;
}

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
    // RENA-066 (James-ruled): a tiny explicit schema of sanctioned
    // performance fields; everything else in the beacon is dropped unread
    // (descriptions, native logs and any free text never reach the log).
    log.info('boot_diag', 'beacon', {
      shell: request.headers.get('x-rena-shell') ?? undefined,
      ...pickBeaconFields(body),
    });
  } catch {
    /* never fail the caller */
  }
  return new NextResponse(null, { status: 204 });
}
