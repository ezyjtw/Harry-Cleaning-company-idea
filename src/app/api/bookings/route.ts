import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerById } from '@/lib/mock-data';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendGuestBookingConfirmation,
} from '@/lib/services/email.service';
import { createPaymentSession } from '@/lib/services/ryft-payment.service';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = [
    'cleanerId',
    'name',
    'email',
    'phone',
    'address',
    'date',
    'time',
    'duration',
    'serviceType',
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Verify cleaner exists
  const cleaner = getCleanerById(body.cleanerId);
  if (!cleaner) {
    return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
  }

  // TODO: In production, save to database via Prisma
  const bookingId = `BK-${Date.now()}`;
  const guestToken = crypto.randomUUID();
  const totalPrice = body.totalPrice || 0;

  const booking = {
    id: bookingId,
    cleanerId: body.cleanerId,
    customerName: body.name,
    customerEmail: body.email,
    customerPhone: body.phone,
    address: body.address,
    date: body.date,
    time: body.time,
    duration: body.duration,
    serviceType: body.serviceType,
    notes: body.notes || '',
    status: 'pending_payment',
    totalPrice,
    guestToken,
    createdAt: new Date().toISOString(),
  };

  // Create Ryft payment session
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let paymentSession = null;

  try {
    paymentSession = await createPaymentSession({
      amount: totalPrice,
      bookingId,
      customerEmail: body.email,
      customerName: body.name,
      description: `${body.serviceType} cleaning - ${body.date}`,
      returnUrl: `${appUrl}/booking/confirmation?bookingId=${bookingId}&token=${guestToken}`,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Payment session creation failed:', error);
    // Continue without payment in dev mode
  }

  // Send confirmation emails
  const bookingEmailData = {
    id: bookingId,
    customerName: body.name,
    cleanerName: cleaner.name,
    date: body.date,
    time: body.time,
    address: body.address,
    serviceType: body.serviceType,
    totalPrice,
  };

  // Send customer confirmation (or guest confirmation with manage link)
  if (body.isGuest) {
    await sendGuestBookingConfirmation(bookingEmailData, body.email, body.name, guestToken).catch(
      () => {}
    );
  } else {
    await sendBookingConfirmation(bookingEmailData, {
      name: body.name,
      email: body.email,
    }).catch(() => {});
  }

  // Send cleaner notification
  await sendCleanerAssignment(bookingEmailData, {
    name: cleaner.name,
    email: `${cleaner.id}@cleaners.rena.com`, // TODO: Use real cleaner email from database
  }).catch(() => {});

  return NextResponse.json(
    {
      message: 'Booking created successfully',
      booking,
      payment: paymentSession
        ? {
            sessionId: paymentSession.id,
            clientSecret: paymentSession.clientSecret,
            status: paymentSession.status,
          }
        : null,
    },
    { status: 201 }
  );
}
