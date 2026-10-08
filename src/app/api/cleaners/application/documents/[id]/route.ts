import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import {
  applicantFailure,
  readApplicationDocument,
  removeDraftDocument,
  resolveApplicant,
} from '@/lib/cleaner-application/service';
import { resolveClientIp } from '@/lib/http/client-ip';

// RENA-101: view an application document (its owner or an admin only; anyone
// else gets the same 404 as a missing id) and remove a draft one (owner only).

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const file = await readApplicationDocument(
    { id: user.id, role: user.role },
    params.id,
    resolveClientIp(request.headers) || undefined
  ).catch(() => null);
  if (!file) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const a = await resolveApplicant();
  if (a.kind !== 'ok') {
    const { ok: _ok, status, ...body } = applicantFailure(a);
    return NextResponse.json(body, { status });
  }
  const r = await removeDraftDocument(a.userId, params.id);
  if (!r.ok) {
    const { ok: _ok, status, ...rest } = r;
    return NextResponse.json(rest, { status });
  }
  return NextResponse.json({ ok: true });
}
