import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendGuestBookingConfirmation,
} from '@/lib/services/email.service';
import { createPaymentSession } from '@/lib/services/stripe-payment.service';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = 10;

    const where: Record<string, unknown> = {};

    if (user.role === 'CLEANER') {
      where.cleanerId = user.id;
    } else {
      where.clientId = user.id;
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          address: true,
          cleaner: { select: { id: true, name: true, image: true } },
          client: { select: { id: true, name: true, image: true } },
          review: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      data: bookings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['cleanerId', 'name', 'email', 'date', 'time', 'duration', 'serviceType'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Verify cleaner exists in database
    const cleaner = await prisma.user.findFirst({
      where: { id: body.cleanerId, role: 'CLEANER' },
      select: { id: true, name: true, email: true },
    });

    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
    }

    let totalPrice = body.totalPrice || 0;
    let discountPercent = 0;
    let discountAmount = 0;
    let promoCode: string | null = null;

    // Validate and apply promo code
    if (body.promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: body.promoCode.toUpperCase().trim() },
      });
      const now = new Date();
      if (
        promo &&
        promo.isActive &&
        (!promo.validUntil || promo.validUntil >= now) &&
        promo.validFrom <= now &&
        (!promo.maxUses || promo.usedCount < promo.maxUses)
      ) {
        discountPercent = promo.discountPercent;
        discountAmount = Math.round(totalPrice * (discountPercent / 100) * 100) / 100;
        totalPrice = Math.round((totalPrice - discountAmount) * 100) / 100;
        promoCode = promo.code;
        await prisma.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    // Cleaner always earns from undiscounted amount — Rena absorbs discount
    const undiscountedTotal = body.totalPrice || 0;
    const platformFee = undiscountedTotal * 0.06;
    const cleanerEarnings = (undiscountedTotal - platformFee) * 0.9;

    // Get or create address
    let addressId: string | null = null;
    if (body.addressId) {
      addressId = body.addressId;
    }

    // Check for authenticated user
    const sessionUser = await getSessionUser();

    const booking = await prisma.booking.create({
      data: {
        clientId: sessionUser?.id || null,
        cleanerId: body.cleanerId,
        addressId,
        guestEmail: !sessionUser ? body.email : null,
        guestName: !sessionUser ? body.name : null,
        guestPhone: !sessionUser ? body.phone : null,
        guestToken: !sessionUser ? crypto.randomUUID() : null,
        serviceType: body.serviceType,
        date: new Date(body.date),
        startTime: body.time,
        duration: body.duration,
        rooms: body.rooms || null,
        extras: body.extras || [],
        frequency: body.frequency || 'one-off',
        totalPrice,
        platformFee,
        cleanerEarnings,
        notes: body.notes || null,
      },
    });

    // Create Stripe payment intent (customer pays discounted amount)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let paymentSession = null;

    try {
      paymentSession = await createPaymentSession({
        amount: totalPrice,
        bookingId: booking.id,
        customerEmail: body.email,
        customerName: body.name,
        description: `${body.serviceType} cleaning - ${body.date}`,
        returnUrl: `${appUrl}/booking/confirmation?bookingId=${booking.id}&token=${booking.guestToken || ''}`,
      });

      if (paymentSession) {
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            stripePaymentId: paymentSession.id,
            amount: totalPrice,
            discountPercent: discountPercent || null,
            discountAmount: discountAmount || null,
            promoCode,
          },
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Payment session creation failed:', error);
    }

    // Send confirmation emails
    const bookingEmailData = {
      id: booking.id,
      customerName: body.name,
      cleanerName: cleaner.name || 'Your cleaner',
      date: body.date,
      time: body.time,
      address: body.address || '',
      serviceType: body.serviceType,
      totalPrice,
    };

    if (!sessionUser) {
      await sendGuestBookingConfirmation(
        bookingEmailData,
        body.email,
        body.name,
        booking.guestToken || ''
      ).catch(() => {});
    } else {
      await sendBookingConfirmation(bookingEmailData, {
        name: body.name,
        email: body.email,
      }).catch(() => {});
    }

    await sendCleanerAssignment(bookingEmailData, {
      name: cleaner.name || '',
      email: cleaner.email,
    }).catch(() => {});

    // Notify the cleaner of the new booking
    await prisma.notification
      .create({
        data: {
          userId: body.cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'New booking request',
          body: `New ${body.serviceType} cleaning on ${body.date}`,
          data: { bookingId: booking.id },
        },
      })
      .catch(() => {});

    // Notify the customer that their booking was created
    if (sessionUser) {
      await prisma.notification
        .create({
          data: {
            userId: sessionUser.id,
            type: 'BOOKING_CONFIRMED',
            title: 'Booking submitted',
            body: `Your ${body.serviceType} cleaning on ${body.date} has been submitted.`,
            data: { bookingId: booking.id },
          },
        })
        .catch(() => {});
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
