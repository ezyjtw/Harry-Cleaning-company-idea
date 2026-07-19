import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { enterAdminPriceAdjust } from '@/lib/services/cascade.service';

type RouteContext = { params: Promise<{ id: string }> };

// H54 (James-ruled): the admin "Adjust price" door. Fires the EXISTING top-up
// machinery — delta request → customer approve page (delta only, never a
// re-charge of the total) → delta charge → proportional money split, booking
// restored to its pre-adjust status with its cleaner. Guarded to live paid
// bookings with no cascade in flight and funds unreleased; audit-logged.
// Never force-charges: the customer must approve, and decline/expiry reverts
// the booking untouched at the old price.
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { amount?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const amount = Number(body.amount);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive number of pounds (the delta to request).' },
      { status: 400 }
    );
  }
  if (amount > 500) {
    return NextResponse.json(
      { error: 'Adjustment capped at £500 — larger changes need a new booking.' },
      { status: 400 }
    );
  }
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
  }

  const result = await enterAdminPriceAdjust({
    bookingId: id,
    topupAmount: amount,
    adminId: admin.id,
    reason,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.reason || 'Adjustment failed' }, { status: 409 });
  }

  return NextResponse.json({
    message: 'Price adjustment requested — the customer has been asked to approve the difference.',
    approvalExpiresAt: result.approvalExpiresAt?.toISOString() ?? null,
  });
}
