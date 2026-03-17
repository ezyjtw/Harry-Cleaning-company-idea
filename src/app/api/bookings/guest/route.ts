import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// UUID-like format validation (accepts standard UUID v4 format)
function isValidToken(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
}

// Mock booking data — in production this would come from Prisma
const MOCK_BOOKINGS: Record<
  string,
  {
    id: string;
    guestToken: string;
    cleanerName: string;
    serviceType: string;
    date: string;
    time: string;
    duration: number;
    address: string;
    totalPrice: number;
    status: string;
    guestEmail: string;
    guestName: string;
    notes: string;
    createdAt: string;
  }
> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': {
    id: 'BK-G001',
    guestToken: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cleanerName: 'Maria Santos',
    serviceType: 'Deep Clean',
    date: '2026-03-22',
    time: '10:00',
    duration: 3,
    address: '42 Baker Street, London W1U 3BW',
    totalPrice: 135,
    status: 'CONFIRMED',
    guestEmail: 'guest@example.com',
    guestName: 'Alex Johnson',
    notes: 'Please bring eco-friendly products',
    createdAt: '2026-03-17T09:30:00Z',
  },
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': {
    id: 'BK-G002',
    guestToken: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    cleanerName: 'Ana Pereira',
    serviceType: 'Standard Cleaning',
    date: '2026-03-25',
    time: '14:00',
    duration: 2,
    address: '10 Downing Street, London SW1A 2AA',
    totalPrice: 70,
    status: 'PENDING',
    guestEmail: 'another-guest@example.com',
    guestName: 'Sam Williams',
    notes: '',
    createdAt: '2026-03-17T11:00:00Z',
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  // In production: const booking = await prisma.booking.findUnique({ where: { guestToken: token } });
  const booking = MOCK_BOOKINGS[token];

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  // In production: const booking = await prisma.booking.findUnique({ where: { guestToken: token } });
  const booking = MOCK_BOOKINGS[token];

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Only allow cancellation if status is PENDING or CONFIRMED
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: 'Booking can only be cancelled when in PENDING or CONFIRMED status' },
      { status: 422 }
    );
  }

  // In production: await prisma.booking.update({ where: { guestToken: token }, data: { status: "CANCELLED" } });
  booking.status = 'CANCELLED';

  return NextResponse.json({
    message: 'Booking cancelled successfully',
    booking,
  });
}
