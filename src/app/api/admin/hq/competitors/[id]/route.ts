import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// R9 HQ — Competitors room: the manual paste-in notes slot. Notes are OUR
// content (James's observations), stored on the place row indefinitely —
// distinct from sampled review content, which lives under the 30-day window.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string.' }, { status: 400 });
  }

  try {
    const place = await prisma.competitorPlace.update({
      where: { id: params.id },
      data: { notes: body.notes.slice(0, 20000) || null },
    });
    return NextResponse.json({ id: place.id, notes: place.notes });
  } catch {
    return NextResponse.json({ error: 'Competitor not found.' }, { status: 404 });
  }
}
