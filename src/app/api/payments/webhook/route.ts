import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { sendBookingConfirmation, sendCleanerAssignment } from '@/lib/services/email.service';
import { verifyWebhookSignature } from '@/lib/services/ryft-payment.service';

/**
 * POST /api/payments/webhook
 *
 * Handles Ryft payment webhooks. On successful payment:
 * 1. Confirms the booking
 * 2. Sends confirmation email to customer
 * 3. Sends assignment notification to cleaner
 *
 * In production, this would also update the database.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('ryft-signature') || '';

    // Verify webhook signature (skip in dev if no secret configured)
    if (process.env.RYFT_WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      // eslint-disable-next-line no-console
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;

    // eslint-disable-next-line no-console
    console.log(`[Webhook] Received event: ${eventType}`);

    if (eventType === 'payment_session.captured' || eventType === 'payment_session.approved') {
      const metadata = event.data?.metadata || {};
      const bookingId = metadata.bookingId;
      const customerName = metadata.customerName || 'Customer';
      const customerEmail = event.data?.customerEmail;

      if (!bookingId) {
        // eslint-disable-next-line no-console
        console.error('[Webhook] No bookingId in metadata');
        return NextResponse.json({ received: true });
      }

      // eslint-disable-next-line no-console
      console.log(`[Webhook] Payment captured for booking ${bookingId}`);

      // TODO: In production, update booking status to CONFIRMED in database
      // await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
      // await prisma.payment.update({ where: { bookingId }, data: { status: 'SUCCEEDED' } });

      // Send confirmation emails
      if (customerEmail) {
        const bookingData = {
          id: bookingId,
          customerName,
          date: metadata.date || 'TBC',
          time: metadata.time || 'TBC',
          address: metadata.address || '',
          serviceType: metadata.serviceType || 'Cleaning',
          totalPrice: (event.data?.amount || 0) / 100,
        };

        await sendBookingConfirmation(bookingData, {
          name: customerName,
          email: customerEmail,
        });

        // Send cleaner notification if we have their details
        if (metadata.cleanerEmail && metadata.cleanerName) {
          await sendCleanerAssignment(bookingData, {
            name: metadata.cleanerName,
            email: metadata.cleanerEmail,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
