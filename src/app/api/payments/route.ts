import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// POST /api/payments — Create a payment intent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, amount } = body;

    if (!bookingId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'bookingId and a positive amount are required.' },
        { status: 400 }
      );
    }

    // TODO: Replace with real Ryft integration
    // const ryft = new Ryft(process.env.RYFT_SECRET_KEY!)
    // const paymentIntent = await ryft.paymentSessions.create({
    //   amount: Math.round(amount * 100), // Convert to pence
    //   currency: 'gbp',
    //   metadata: { bookingId },
    // })

    const mockPayment = {
      id: `pay_${Date.now()}`,
      bookingId,
      amount,
      currency: 'gbp',
      status: 'pending',
      clientSecret: `mock_secret_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(mockPayment, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create payment.' }, { status: 500 });
  }
}

// GET /api/payments?bookingId=xxx — Get payment status
export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get('bookingId');

  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId query parameter is required.' }, { status: 400 });
  }

  // TODO: Replace with real database lookup
  const mockPayment = {
    id: `pay_mock_${bookingId}`,
    bookingId,
    amount: 85.0,
    currency: 'gbp',
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(mockPayment);
}
