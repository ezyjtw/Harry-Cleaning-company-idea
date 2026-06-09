import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { refundBooking } from '@/lib/services/refund.service';

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId, amount, reason } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const result = await refundBooking(bookingId, amount, reason, {
    triggeredBy: admin.id,
  });

  if (result.status === 'FAILED' || result.status === 'SKIPPED') {
    return NextResponse.json({ error: result.reason, status: result.status }, { status: 400 });
  }

  return NextResponse.json(result);
}
