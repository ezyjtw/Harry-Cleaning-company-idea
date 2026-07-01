import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { disconnect } from '@/lib/services/xero.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/xero/disconnect — admin-only. Removes the stored connection
// (and its encrypted tokens). Does not revoke at Xero's side.
export async function POST() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await disconnect();
  return NextResponse.json({ ok: true });
}
