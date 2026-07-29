import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';

// F23: the cleaner's answer to an arrangement request — Accept or Decline.
// Auth is strictly the owning cleaner (the service re-checks cleanerId).
// Accept re-validates the slot, claims PENDING→ACTIVE atomically, mints from
// the customer's start date and fires the first charge NOW (James-ruled).
// Decline claims PENDING→DECLINED — no charge was ever taken.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').toUpperCase();
  if (action !== 'ACCEPT' && action !== 'DECLINE') {
    return NextResponse.json({ error: 'Action must be ACCEPT or DECLINE.' }, { status: 400 });
  }

  const { acceptArrangement, declineArrangement } =
    await import('@/lib/services/arrangement.service');
  const result =
    action === 'ACCEPT'
      ? await acceptArrangement(id, user.id)
      : await declineArrangement(id, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({
    success: true,
    ...(action === 'ACCEPT' ? { chargeOutcome: result.chargeOutcome } : {}),
  });
}
