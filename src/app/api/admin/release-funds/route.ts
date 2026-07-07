// Admin override for releaseBookingFunds — manual trigger for stuck,
// FAILED, or UNKNOWN releases. The scheduler handles normal auto-release;
// this endpoint is the permanent retry/override path.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { releaseBookingFunds } from '@/lib/services/transfer.service';

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { bookingId } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  // S5: the manual admin release explicitly logs the acting admin — the transfer
  // service writes the FUNDS_RELEASED audit entry with this actor + trigger.
  const result = await releaseBookingFunds(bookingId, { trigger: 'ADMIN', actorId: admin.id });
  return NextResponse.json(result);
}
