import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { CURRENT_AGREEMENT } from '@/lib/legal/self-employment-acknowledgment';
import { getAcknowledgmentStatus, recordAcknowledgment } from '@/lib/services/agreement.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/cleaner/agreement — current acknowledgment document + this cleaner's status.
// POST /api/cleaner/agreement — record acknowledgment of the current version.
// Cleaner-only.

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const status = await getAcknowledgmentStatus(user.id);
  return NextResponse.json({
    document: {
      version: CURRENT_AGREEMENT.version,
      kind: CURRENT_AGREEMENT.kind,
      title: CURRENT_AGREEMENT.title,
      effectiveDate: CURRENT_AGREEMENT.effectiveDate,
      body: CURRENT_AGREEMENT.body,
    },
    status,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'You must confirm you have read and understand the acknowledgment.' },
      { status: 400 }
    );
  }

  const ipAddress =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const status = await recordAcknowledgment({ cleanerId: user.id, ipAddress, userAgent });
  return NextResponse.json({ status });
}
