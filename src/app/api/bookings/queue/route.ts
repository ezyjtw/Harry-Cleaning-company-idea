import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CleanerQueueService } from '@/lib/services/cleaner-queue.service';
import type { MatchingCriteria } from '@/lib/services/matching.service';
import type { ServiceSlug } from '@/lib/services/pricing.service';

/**
 * POST /api/bookings/queue
 *
 * Create a queued booking with the top 3 cleaners.
 * Escrows the highest quote via Ryft so funds are guaranteed.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = ['postcode', 'date', 'startTime', 'duration', 'serviceType', 'email', 'name'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  try {
    const criteria: MatchingCriteria = {
      date: new Date(body.date),
      startTime: body.startTime,
      duration: Number(body.duration),
      serviceType: body.serviceType,
      postcode: body.postcode,
      location: body.location ?? undefined,
      clientId: body.clientId ?? undefined,
      preferredCleanerId: body.preferredCleanerId ?? undefined,
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const result = await CleanerQueueService.createQueuedBooking({
      criteria,
      quoteInput: {
        serviceSlug: body.serviceType as ServiceSlug,
        hours: body.duration ? Number(body.duration) : undefined,
        propertySize: body.propertySize ?? undefined,
        frequency: body.frequency ?? undefined,
        addons: body.addons ?? [],
      },
      customerEmail: body.email,
      customerName: body.name,
      bookingData: {
        clientId: body.clientId ?? undefined,
        guestEmail: body.isGuest ? body.email : undefined,
        guestName: body.isGuest ? body.name : undefined,
        guestPhone: body.phone ?? undefined,
        address: body.address ?? '',
        addressId: body.addressId ?? undefined,
        notes: body.notes ?? undefined,
        serviceType: body.serviceType,
      },
      returnUrl: `${appUrl}/booking/confirmation`,
    });

    return NextResponse.json(
      {
        message: `Booking queued with top ${result.queuedCleaners.length} cleaners`,
        bookingId: result.bookingId,
        holdAmount: result.holdAmount,
        lowestQuote: result.lowestQuote,
        highestQuote: result.highestQuote,
        cleaners: result.queuedCleaners.map((c) => ({
          rank: c.rank,
          name: c.cleanerName,
          quotedTotal: c.quote.customerTotal,
          cleanerPayout: c.quote.cleanerPayout,
        })),
        payment: result.payment,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create queued booking';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
