import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createPaymentSession, getPaymentSession } from '@/lib/services/ryft-payment.service';

// POST /api/payments — Create a Ryft payment session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, amount, customerEmail, customerName, returnUrl, description } = body;

    if (!bookingId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'bookingId and a positive amount are required.' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await createPaymentSession({
      amount,
      bookingId,
      customerEmail: customerEmail || '',
      customerName: customerName || '',
      description: description || `Rena Cleaning - Booking ${bookingId}`,
      returnUrl: returnUrl || `${appUrl}/booking/confirmation?bookingId=${bookingId}`,
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Payment creation error:', error);
    return NextResponse.json({ error: 'Failed to create payment.' }, { status: 500 });
  }
}

// GET /api/payments?sessionId=xxx — Get payment session status
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query parameter is required.' }, { status: 400 });
  }

  const session = await getPaymentSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Payment session not found.' }, { status: 404 });
  }

  return NextResponse.json(session);
}
