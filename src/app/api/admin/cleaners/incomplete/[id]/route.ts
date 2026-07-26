import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { removeIncompleteSignup } from '@/lib/services/incomplete-signup.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * H106 (James-ruled): admin broom for INCOMPLETE signups only — a User with
 * role CLEANER and NO CleanerProfile (a step-0 account whose wizard never
 * finished). This is NOT H103 account deletion: an incomplete signup has no
 * profile, no bookings, no money, no documents. The structural guard lives in
 * removeIncompleteSignup (LB-3: shared with the 30-day auto-expiry sweep).
 */
export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const result = await removeIncompleteSignup({ userId: context.params.id, actorId: admin.id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // eslint-disable-next-line no-console
  console.log(`[AdminBroom] incomplete signup removed: ${result.email} (by ${admin.id})`);

  return NextResponse.json({ ok: true });
}
