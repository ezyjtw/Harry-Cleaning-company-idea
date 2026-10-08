import { NextResponse } from 'next/server';

import {
  applicantFailure,
  getApplication,
  resolveApplicant,
  saveApplicationStep,
  type Failure,
} from '@/lib/cleaner-application/service';
import { log } from '@/lib/log';
import { checkRateLimit } from '@/lib/rate-limit';

// RENA-100 (James-ruled 2026-10-08): the join wizard's server-side draft. The
// applicant is always the session's CLEANER user; nothing here takes an id.

export const dynamic = 'force-dynamic';

function failure(f: Failure) {
  const { ok: _ok, status, ...body } = f;
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const a = await resolveApplicant();
  if (a.kind !== 'ok') return failure(applicantFailure(a));
  const app = await getApplication(a.userId);
  return NextResponse.json(app, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const a = await resolveApplicant();
  if (a.kind !== 'ok') return failure(applicantFailure(a));
  const rl = checkRateLimit(`cleaner-application-save:${a.userId}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', error: 'Too many saves. Please wait a moment.' },
      { status: 429 }
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return failure({ ok: false, status: 400, code: 'BAD_REQUEST', error: 'Bad request.' });
  const r = await saveApplicationStep(a.userId, {
    version: body.version,
    completedStep: body.completedStep,
    data: body.data,
    dateOfBirth: body.dateOfBirth,
  });
  if (!r.ok) {
    if (r.status === 409)
      log.info('cleaner_application', 'save_conflict', { userId: a.userId, code: r.code });
    return failure(r);
  }
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}
