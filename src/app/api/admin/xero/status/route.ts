import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { getStatus } from '@/lib/services/xero.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/xero/status — admin-only. Connection status for the admin UI.
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await getStatus());
}
