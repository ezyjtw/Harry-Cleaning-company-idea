// POST /api/admin/stuck-money/action { action, bookingId, refId }
//
// B4 (RENA-015): the stuck-money queue's actions, by name. Each one runs the
// service function that owns the state (read Stripe, or move money through
// its keyed, idempotent path); every money move is audited there with the
// acting admin. Replaces /api/admin/bookings/retry-refund.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { log } from '@/lib/log';
import type { AbnormalAction } from '@/lib/money/abnormal-states';
import { runStuckMoneyAction, STUCK_MONEY_ACTIONS } from '@/lib/money/stuck-money-actions';

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  let body: { action?: unknown; bookingId?: unknown; refId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { action, bookingId, refId } = body;
  if (typeof action !== 'string' || !STUCK_MONEY_ACTIONS.includes(action as AbnormalAction)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (typeof bookingId !== 'string' || !bookingId || typeof refId !== 'string' || !refId) {
    return NextResponse.json({ error: 'bookingId and refId are required' }, { status: 400 });
  }
  try {
    const result = await runStuckMoneyAction(action as AbnormalAction, bookingId, refId, admin.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    log.error('stuck_money', 'action_failed', { action, bookingId }, err);
    return NextResponse.json(
      { ok: false, message: 'The action failed; nothing further was changed. Check the logs.' },
      { status: 500 }
    );
  }
}
