import { NextResponse } from 'next/server';

import {
  applicantFailure,
  resolveApplicant,
  uploadDraftDocument,
} from '@/lib/cleaner-application/service';
import { resolveClientIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit';

// RENA-101 (James-ruled 2026-10-08): a draft application document, uploaded
// when selected. The owner is the session, never the body; the object key is
// server-generated; a replacement names the document it replaces.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const a = await resolveApplicant();
  if (a.kind !== 'ok') {
    const { ok: _ok, status, ...body } = applicantFailure(a);
    return NextResponse.json(body, { status });
  }
  const rl = checkRateLimit(`cleaner-application-doc:${a.userId}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', error: 'Too many uploads. Please wait a moment.' },
      { status: 429 }
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body)
    return NextResponse.json({ code: 'BAD_REQUEST', error: 'Bad request.' }, { status: 400 });
  const r = await uploadDraftDocument(
    a.userId,
    { category: body.category, fileData: body.fileData, replaceId: body.replaceId },
    { ipAddress: resolveClientIp(request.headers) || undefined }
  );
  if (!r.ok) {
    const { ok: _ok, status, ...rest } = r;
    return NextResponse.json(rest, { status });
  }
  return NextResponse.json({ document: r.document }, { status: 201 });
}
