import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { PROSPECT_STATUSES } from '@/lib/hq/prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// R9 HQ — Reachout pipeline, one prospect: PATCH edits fields (status moves
// the board card), POST appends a note to the history. No delete — the
// pipeline is a record; a dead lead is `stalled`, not erased.

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if ('email' in body)
    data.email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;
  if ('phone' in body)
    data.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
  if ('area' in body)
    data.area = typeof body.area === 'string' && body.area.trim() ? body.area.trim() : null;
  if (typeof body.status === 'string') {
    if (!(PROSPECT_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
    }
    data.status = body.status;
  }
  if ('nextActionAt' in body) {
    data.nextActionAt =
      typeof body.nextActionAt === 'string' && body.nextActionAt
        ? new Date(body.nextActionAt)
        : null;
  }

  try {
    const prospect = await prisma.prospect.update({
      where: { id: params.id },
      data,
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json({ prospect });
  } catch {
    return NextResponse.json({ error: 'Prospect not found or update failed.' }, { status: 404 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const text = typeof body.note === 'string' ? body.note.trim() : '';
  if (!text) return NextResponse.json({ error: 'Note text is required.' }, { status: 400 });

  try {
    await prisma.prospectNote.create({ data: { prospectId: params.id, body: text } });
    const prospect = await prisma.prospect.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    return NextResponse.json({ prospect }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  }
}
