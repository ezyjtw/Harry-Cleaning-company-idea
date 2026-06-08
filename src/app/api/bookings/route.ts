import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import { normalizeToPricingSlug } from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import {
  sendBookingConfirmation,
  sendCleanerAssignment,
  sendGuestBookingConfirmation,
} from '@/lib/services/email.service';
import { pricingService } from '@/lib/services/pricing.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import stripe from '@/lib/stripe';

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

    const allBackupIds = Array.from(new Set(bookings.flatMap((b) => b.backupCleanerIds)));
    const backupUsers =
      allBackupIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: allBackupIds } },
            select: { id: true, name: true },
          })
        : [];
    const backupNameMap = new Map(backupUsers.map((u) => [u.id, u.name || 'Cleaner']));

    const resolvedBookings = await Promise.all(
      bookings.map(async (b) => ({
        ...b,
        backupCleanerNames: b.backupCleanerIds.map((id) => backupNameMap.get(id) || 'Cleaner'),
        cleaner: { ...b.cleaner, image: await resolveProfileImageUrl(b.cleaner?.image) },
        client: { ...b.client, image: await resolveProfileImageUrl(b.client?.image) },
      }))
    );

    return NextResponse.json({
      data: resolvedBookings,
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

    // 1. Validate required fields
    const required = ['cleanerId', 'name', 'email', 'date', 'time', 'duration', 'serviceType'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // 1b. Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return NextResponse.json({ error: 'date must be in YYYY-MM-DD format.' }, { status: 400 });
    }

    const bookingDate = new Date(`${body.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate <= today) {
      return NextResponse.json(
        {
          error:
            'Booking date must be in the future. Same-day bookings are not currently available.',
        },
        { status: 400 }
      );
    }

    if (!SAME_DAY_FEATURE_ENABLED && body.serviceType === 'same-day') {
      return NextResponse.json(
        { error: 'Same-day bookings are not currently available.' },
        { status: 400 }
      );
    }

    // 2. Cleaner lookup with Stripe eligibility
    const cleaner = await prisma.user.findFirst({
      where: { id: body.cleanerId, role: 'CLEANER' },
      select: {
        id: true,
        name: true,
        email: true,
        cleanerProfile: {
          select: {
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            homePostcode: true,
            maxTravelMinutes: true,
          },
        },
      },
    });

    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
    }

    // 4. Stripe eligibility check
    if (
      !cleaner.cleanerProfile?.stripeAccountId ||
      !cleaner.cleanerProfile?.stripeChargesEnabled ||
      !cleaner.cleanerProfile?.stripePayoutsEnabled
    ) {
      return NextResponse.json(
        {
          error:
            'This cleaner is not yet set up to receive payments. Please choose another cleaner.',
        },
        { status: 400 }
      );
    }

    // 4b. Service area defensive check
    if (
      !cleaner.cleanerProfile?.homePostcode ||
      cleaner.cleanerProfile?.maxTravelMinutes === null
    ) {
      return NextResponse.json(
        {
          error:
            'This cleaner has not set up their service area yet. Please choose another cleaner or try again later.',
        },
        { status: 400 }
      );
    }

    // 3. Service type validation
    const pricingSlug = normalizeToPricingSlug(body.serviceType);

    // 5. Price calculation — never trust client-submitted totals
    let quote;
    try {
      quote = await pricingService.calculateQuote({
        cleanerId: body.cleanerId,
        serviceSlug: pricingSlug,
        hours: body.duration ? Number(body.duration) : undefined,
        propertySize: body.propertySize || undefined,
        addons: body.addons || undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pricing error';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Price discrepancy detection
    const clientTotal = body.totalPrice ? Number(body.totalPrice) : null;
    if (clientTotal !== null) {
      const diff = Math.abs(clientTotal - quote.customerTotal);
      if (diff > 1.0) {
        const ip = getClientIp(request);
        const sessionUser = await getSessionUser();

        await AuditService.log({
          userId: sessionUser?.id,
          action: 'PRICE_DISCREPANCY_DETECTED',
          entityType: 'Booking',
          entityId: body.cleanerId,
          metadata: {
            clientTotal,
            serverTotal: quote.customerTotal,
            difference: diff,
            cleanerId: body.cleanerId,
            serviceType: body.serviceType,
            ip,
          },
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined,
        });

        const tamperCheck = checkRateLimit(`price-discrepancy:${ip}`, 4, 60 * 60 * 1000);
        if (!tamperCheck.allowed) {
          await AuditService.log({
            userId: sessionUser?.id,
            action: 'PRICE_TAMPERING_SUSPECTED',
            entityType: 'Booking',
            entityId: body.cleanerId,
            metadata: { ip, discrepancyCount: 5 },
            ipAddress: ip,
          });
        }

        return NextResponse.json(
          {
            error: 'PRICE_MISMATCH',
            message:
              'The price has changed since this page was loaded. Please refresh and try again.',
            expectedTotal: quote.customerTotal,
          },
          { status: 409 }
        );
      }
    }

    let totalPrice = quote.customerTotal;
    const platformFee = quote.customerPlatformFee;
    const cleanerEarnings = quote.cleanerPayout;

    let discountPercent = 0;
    let discountAmount = 0;
    let promoCode: string | null = null;

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

    // ─── Backup cleaner validation ─────
    const backupCleanerIds: string[] = Array.isArray(body.backupCleanerIds)
      ? body.backupCleanerIds
      : [];
    const autoAssignBackup: boolean = body.autoAssignBackup === true;

    if (backupCleanerIds.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 backup cleaners allowed.' }, { status: 400 });
    }

    if (backupCleanerIds.length > 0) {
      if (new Set(backupCleanerIds).size !== backupCleanerIds.length) {
        return NextResponse.json(
          { error: 'Duplicate backup cleaner IDs are not allowed.' },
          { status: 400 }
        );
      }

      if (backupCleanerIds.includes(body.cleanerId)) {
        return NextResponse.json(
          { error: 'Primary cleaner cannot be in the backup list.' },
          { status: 400 }
        );
      }

      const backupProfiles = await prisma.cleanerProfile.findMany({
        where: { userId: { in: backupCleanerIds } },
        select: { userId: true },
      });
      const foundIds = new Set(backupProfiles.map((p) => p.userId));
      const missing = backupCleanerIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Invalid backup cleaner IDs: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }

    let addressId: string | null = null;
    if (body.addressId) {
      addressId = body.addressId;
    }

    // 6. Ensure customer has Stripe Customer ID (authenticated users only)
    const sessionUser = await getSessionUser();
    let stripeCustomerId: string | null = null;

    if (sessionUser) {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { stripeCustomerId: true, email: true, name: true },
      });

      if (dbUser?.stripeCustomerId) {
        try {
          await stripe.customers.retrieve(dbUser.stripeCustomerId);
          stripeCustomerId = dbUser.stripeCustomerId;
        } catch {
          // Stripe Customer deleted — create a new one
        }
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: dbUser?.email || sessionUser.email,
          name: dbUser?.name || undefined,
          metadata: { userId: sessionUser.id },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: sessionUser.id },
          data: { stripeCustomerId: customer.id },
        });
      }
    }

    // 7. Fee breakdown is already computed by the pricing service
    // quote.customerPlatformFee = 6% service fee
    // quote.cleanerCommission = 10% or 15% commission from base
    // quote.cleanerPayout = base - commission
    // platformFee (application_fee) = customerTotal - cleanerPayout
    const applicationFeeGBP = totalPrice - quote.cleanerPayout;

    // 8. Create Booking record FIRST with paymentStatus: PENDING
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
        frequency: 'one_off',
        totalPrice,
        platformFee,
        cleanerEarnings,
        cleanerPayoutAmount: quote.cleanerPayout,
        platformCommissionAmount: quote.cleanerCommission,
        platformFeeAmount: quote.customerPlatformFee,
        totalAmountCharged: totalPrice,
        customerSubtotal: quote.cleanerListedPrice,
        customerServiceFee: quote.customerPlatformFee,
        renaEarns: quote.cleanerCommission + quote.customerPlatformFee,
        propertySize: body.propertySize || null,
        notes: body.notes || null,
        paymentStatus: 'PENDING',
        backupCleanerIds,
        autoAssignBackup,
      },
    });

    // 9. Create Stripe PaymentIntent
    let clientSecret: string | null = null;
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100),
        currency: 'gbp',
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        ...(stripeCustomerId ? { setup_future_usage: 'off_session' as const } : {}),
        application_fee_amount: Math.round(applicationFeeGBP * 100),
        transfer_data: { destination: cleaner.cleanerProfile.stripeAccountId },
        on_behalf_of: cleaner.cleanerProfile.stripeAccountId,
        metadata: {
          bookingId: booking.id,
          customerId: sessionUser?.id || '',
          cleanerId: cleaner.id,
          serviceType: body.serviceType,
        },
        automatic_payment_methods: { enabled: true },
      });

      clientSecret = paymentIntent.client_secret;

      // 10. Update Booking with stripePaymentIntentId
      await prisma.booking.update({
        where: { id: booking.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('PaymentIntent creation failed:', error);

      // Mark booking as failed — don't leave orphan PENDING bookings
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          cancelledAt: new Date(),
          cancellationReason: 'Payment initialization failed',
        },
      });

      return NextResponse.json(
        { error: 'Failed to initialize payment. Please try again.' },
        { status: 500 }
      );
    }

    // Store promo code info on payment record
    if (discountPercent > 0) {
      await prisma.payment
        .create({
          data: {
            bookingId: booking.id,
            amount: totalPrice,
            discountPercent,
            discountAmount,
            promoCode,
          },
        })
        .catch(() => {});
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
        clientSecret,
      },
      { status: 201 }
    );
    // TEMPORARY DEBUG — REVERT AFTER DIAGNOSIS
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/bookings] Unhandled error:', error);

    if (process.env.NODE_ENV === 'production') {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      return NextResponse.json({ error: message, stack }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
