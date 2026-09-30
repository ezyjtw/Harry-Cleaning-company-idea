import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { PROSPECT_STATUSES } from '@/lib/hq/prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// R9 HQ — Reachout pipeline: list + create. Statuses are the ruled five:
// found | contacted | replied | stalled | joined.

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const prospects = await prisma.prospect.findMany({
    include: { notes: { orderBy: { createdAt: 'desc' } } },
    orderBy: [{ nextActionAt: 'asc' }, { updatedAt: 'desc' }],
  });
  return NextResponse.json({ prospects });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  const status =
    typeof body.status === 'string' &&
    (PROSPECT_STATUSES as readonly string[]).includes(body.status)
      ? body.status
      : 'found';
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;

  try {
    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
        area: typeof body.area === 'string' && body.area.trim() ? body.area.trim() : null,
        status,
        source: 'manual',
        nextActionAt:
          typeof body.nextActionAt === 'string' && body.nextActionAt
            ? new Date(body.nextActionAt)
            : null,
      },
      include: { notes: true },
    });
    return NextResponse.json({ prospect }, { status: 201 });
  } catch (err) {
    // unique email collision is the one expected failure
    const msg =
      err instanceof Error && err.message.includes('Unique constraint')
        ? 'A prospect with that email already exists.'
        : 'Could not create the prospect.';
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
