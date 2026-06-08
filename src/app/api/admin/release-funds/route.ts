// TEMPORARY — manual trigger for releaseBookingFunds.
// Replace with A6 scheduler. Remove this route when A6 ships.

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

  const result = await releaseBookingFunds(bookingId);
  return NextResponse.json(result);
}
