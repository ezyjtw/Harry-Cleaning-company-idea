import { NextResponse } from 'next/server';

import {
  applicantFailure,
  finaliseApplication,
  resolveApplicant,
} from '@/lib/cleaner-application/service';
import { resolveClientIp } from '@/lib/http/client-ip';
import { log } from '@/lib/log';
import { checkRateLimit } from '@/lib/rate-limit';

// RENA-101 (James-ruled 2026-10-08): finalise the application. No uploads
// happen here: the authoritative draft and its STORED documents are checked,
// then one transaction creates the profile. The response says whether the Pro
// shell gets a single-use handoff code or simply moves on.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const a = await resolveApplicant();
  if (a.kind !== 'ok') {
    const { ok: _ok, status, ...body } = applicantFailure(a);
    return NextResponse.json(body, { status });
  }
  const rl = checkRateLimit(`cleaner-application-submit:${a.userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a moment.' },
      { status: 429 }
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const r = await finaliseApplication(
      { userId: a.userId, sessionJti: a.sessionJti },
      { version: body?.version, agreedToTerms: body?.agreedToTerms },
      {
        headers: request.headers,
        ipAddress: resolveClientIp(request.headers) || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      }
    );
    if (!r.ok) {
      const { ok: _ok, status, ...rest } = r;
      return NextResponse.json(rest, { status });
    }
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('cleaner_application', 'finalise_failed', { userId: a.userId }, err);
    return NextResponse.json(
      {
        code: 'FINALISE_FAILED',
        error:
          'We could not submit your application just now. Your progress is saved, please try again.',
      },
      { status: 500 }
    );
  }
}
