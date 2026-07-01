import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { getMapping, saveMapping, type XeroMapping } from '@/lib/services/xero.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  /api/admin/xero/mapping — current account mappings + feature flag.
// PUT  /api/admin/xero/mapping — save mappings and/or toggle pushEnabled.
// Admin-only. Enabling pushes with an incomplete mapping is rejected (400).

const STRING_KEYS = [
  'bankAccountCode',
  'commissionAccountCode',
  'feeAccountCode',
  'clearingAccountCode',
] as const;

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const mapping = await getMapping();
  if (!mapping) {
    return NextResponse.json({ error: 'Xero is not connected.' }, { status: 409 });
  }
  return NextResponse.json({ mapping });
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Whitelist + type-check the incoming fields.
  const patch: Partial<XeroMapping> = {};
  for (const key of STRING_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: `"${key}" must be a string or null.` }, { status: 400 });
    }
    patch[key] = value === '' ? null : (value as string | null);
  }
  if (body.pushEnabled !== undefined) {
    if (typeof body.pushEnabled !== 'boolean') {
      return NextResponse.json({ error: '"pushEnabled" must be a boolean.' }, { status: 400 });
    }
    patch.pushEnabled = body.pushEnabled;
  }

  try {
    const mapping = await saveMapping(patch);
    return NextResponse.json({ mapping });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save mappings.' },
      { status: 400 }
    );
  }
}
