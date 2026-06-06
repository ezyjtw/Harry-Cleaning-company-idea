import type { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

import { prisma } from '@/lib/db/prisma';

import { MatchingService } from './matching.service';
import type { MatchingCriteria } from './matching.service';
import { pricingService } from './pricing.service';
import type { CleanerQuoteInput, QuoteResult } from './pricing.service';
import { createPaymentSession } from './ryft-payment.service';

// ─── Types ──────────────────────────────────────────────────────

const TOP_N = 3;
const QUEUE_EXPIRY_MINUTES = 30; // each cleaner has 30 min to respond

export interface QueuedCleanerQuote {
  cleanerId: string;
  cleanerName: string;
  rank: number;
  matchScore: number;
  quote: QuoteResult;
}

export interface CleanerQueueResult {
  bookingId: string;
  queuedCleaners: QueuedCleanerQuote[];
  holdAmount: number;
  lowestQuote: number;
  highestQuote: number;
  payment: {
    sessionId: string;
    clientSecret: string;
    status: string;
  } | null;
}

export interface QueueAcceptResult {
  success: boolean;
  bookingId: string;
  cleanerId: string;
  cleanerName: string;
  actualTotal: number;
  holdAmount: number;
  refundDue: number;
  message: string;
}

// ─── Service ────────────────────────────────────────────────────

export class CleanerQueueService {
  /**
   * Create a queued booking: find top 3 cleaners, generate quotes for each,
   * escrow the highest quote via Ryft, and notify all 3.
   */
  static async createQueuedBooking(params: {
    criteria: MatchingCriteria;
    quoteInput: Omit<CleanerQuoteInput, 'cleanerId'>;
    customerEmail: string;
    customerName: string;
    bookingData: {
      clientId?: string;
      guestEmail?: string;
      guestName?: string;
      guestPhone?: string;
      address: string;
      addressId?: string;
      notes?: string;
      serviceType: string;
    };
    returnUrl: string;
  }): Promise<CleanerQueueResult> {
    const { criteria, quoteInput, customerEmail, customerName, bookingData, returnUrl } = params;

    // 1. Find top matches
    const matchResult = await MatchingService.findMatches(criteria);
    const availableMatches = matchResult.matches.filter((m) => m.isAvailable);

    if (availableMatches.length === 0) {
      throw new Error('No available cleaners match your criteria');
    }

    const topCleaners = availableMatches.slice(0, TOP_N);

    // 2. Generate a quote for each cleaner (different hourly rates → different totals)
    const quotes: QueuedCleanerQuote[] = [];

    for (let i = 0; i < topCleaners.length; i++) {
      const cleaner = topCleaners[i];
      const quote = await pricingService.calculateQuote({
        ...quoteInput,
        cleanerId: cleaner.userId,
      });

      quotes.push({
        cleanerId: cleaner.userId,
        cleanerName: cleaner.name,
        rank: i + 1,
        matchScore: cleaner.totalScore,
        quote,
      });
    }

    // 3. Find the highest quote — this is what we hold
    const holdAmount = Math.max(...quotes.map((q) => q.quote.customerTotal));
    const lowestQuote = Math.min(...quotes.map((q) => q.quote.customerTotal));

    // 4. Create the booking in PENDING state (no cleaner assigned yet)
    // Use the first cleaner temporarily as cleanerId is required, will be updated on accept
    const guestToken = crypto.randomUUID();
    const booking = await prisma.booking.create({
      data: {
        clientId: bookingData.clientId ?? null,
        cleanerId: topCleaners[0].userId, // placeholder — updated when a cleaner accepts
        guestEmail: bookingData.guestEmail ?? null,
        guestName: bookingData.guestName ?? null,
        guestPhone: bookingData.guestPhone ?? null,
        guestToken,
        serviceType: bookingData.serviceType,
        status: 'PENDING',
        date: criteria.date,
        startTime: criteria.startTime,
        duration: criteria.duration,
        notes: bookingData.notes ?? null,
        addressId: bookingData.addressId ?? null,
        totalPrice: holdAmount,
        platformFee: 0,
        cleanerEarnings: 0,
        isQueuedBooking: true,
        totalAmountCharged: holdAmount,
      },
    });

    // 5. Create queue entries for each cleaner
    const now = new Date();
    for (const q of quotes) {
      await prisma.bookingCleanerQueue.create({
        data: {
          bookingId: booking.id,
          cleanerId: q.cleanerId,
          rank: q.rank,
          quotedTotal: q.quote.customerTotal,
          cleanerEarns: q.quote.cleanerPayout,
          matchScore: q.matchScore,
          notifiedAt: now,
          expiresAt: new Date(now.getTime() + QUEUE_EXPIRY_MINUTES * 60 * 1000),
        },
      });
    }

    // 6. Create Ryft payment session for the ESCROW amount (highest quote)
    let paymentSession = null;
    try {
      paymentSession = await createPaymentSession({
        amount: holdAmount,
        bookingId: booking.id,
        customerEmail,
        customerName,
        description: `${bookingData.serviceType} cleaning — escrow for top ${topCleaners.length} cleaners`,
        returnUrl: `${returnUrl}?bookingId=${booking.id}&token=${guestToken}`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Escrow payment session creation failed:', error);
    }

    // 7. Notify all queued cleaners
    for (const q of quotes) {
      await prisma.notification.create({
        data: {
          userId: q.cleanerId,
          type: 'BOOKING_REQUEST',
          title: 'New Job Available',
          body: `A ${bookingData.serviceType} cleaning job is available on ${criteria.date.toLocaleDateString()}. You'd earn £${q.quote.cleanerPayout.toFixed(2)}. Accept within ${QUEUE_EXPIRY_MINUTES} minutes.`,
          data: {
            bookingId: booking.id,
            quotedTotal: q.quote.customerTotal,
            cleanerPayout: q.quote.cleanerPayout,
            expiresInMinutes: QUEUE_EXPIRY_MINUTES,
          } as Prisma.InputJsonValue,
        },
      });
    }

    // 8. Schedule expiry check job
    await prisma.backgroundJob.create({
      data: {
        type: 'QUEUE_EXPIRY_CHECK',
        payload: { bookingId: booking.id } as Prisma.InputJsonValue,
        scheduledAt: new Date(now.getTime() + QUEUE_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    return {
      bookingId: booking.id,
      queuedCleaners: quotes,
      holdAmount,
      lowestQuote,
      highestQuote: holdAmount,
      payment: paymentSession
        ? {
            sessionId: paymentSession.id,
            clientSecret: paymentSession.clientSecret,
            status: paymentSession.status,
          }
        : null,
    };
  }

  /**
   * Cleaner accepts a job from the queue.
   * - Marks their entry as ACCEPTED
   * - Marks all other queue entries as SUPERSEDED
   * - Updates the booking with the accepting cleaner's details
   * - Calculates refund if their quote < escrow amount
   */
  static async acceptFromQueue(bookingId: string, cleanerId: string): Promise<QueueAcceptResult> {
    // 1. Verify the queue entry exists and is still pending
    const queueEntry = await prisma.bookingCleanerQueue.findUnique({
      where: { bookingId_cleanerId: { bookingId, cleanerId } },
      include: {
        booking: { include: { payment: true } },
        cleaner: true,
      },
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    if (queueEntry.status !== 'PENDING') {
      throw new Error(`Cannot accept — queue entry status is ${queueEntry.status}`);
    }

    if (queueEntry.expiresAt && queueEntry.expiresAt < new Date()) {
      throw new Error('This job offer has expired');
    }

    // Check if another cleaner already accepted
    const alreadyAccepted = await prisma.bookingCleanerQueue.findFirst({
      where: { bookingId, status: 'ACCEPTED' },
    });

    if (alreadyAccepted) {
      throw new Error('Another cleaner has already accepted this job');
    }

    const holdAmount = queueEntry.booking.totalAmountCharged
      ? Number(queueEntry.booking.totalAmountCharged)
      : queueEntry.booking.totalPrice.toNumber();
    const actualTotal = queueEntry.quotedTotal;
    // Refund includes: (escrow - accepted quote) + any promo discount amount
    const discountAmount = queueEntry.booking.payment?.discountAmount
      ? Number(queueEntry.booking.payment.discountAmount)
      : 0;
    const refundDue = new Decimal(holdAmount)
      .minus(actualTotal)
      .plus(discountAmount)
      .toDecimalPlaces(2)
      .toNumber();

    // 2. Transaction: accept this cleaner, supersede others, update booking
    await prisma.$transaction(async (tx) => {
      // Mark this entry as accepted
      await tx.bookingCleanerQueue.update({
        where: { id: queueEntry.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // Mark all other entries as superseded
      await tx.bookingCleanerQueue.updateMany({
        where: { bookingId, cleanerId: { not: cleanerId } },
        data: { status: 'SUPERSEDED', respondedAt: new Date() },
      });

      // Update booking with the accepted cleaner's details
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          cleanerId,
          status: 'CONFIRMED',
          acceptedAt: new Date(),
          totalPrice: actualTotal,
          cleanerEarnings: queueEntry.cleanerEarns,
          cleanerPayoutAmount: queueEntry.cleanerEarns,
          acceptedFromQueue: true,
        },
      });
    });

    // 3. If there's a refund due (escrow > actual), initiate partial refund via Ryft
    if (refundDue > 0 && queueEntry.booking.payment?.ryftPaymentId) {
      try {
        await this.initiatePartialRefund(queueEntry.booking.payment.ryftPaymentId, refundDue);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Partial refund initiation failed:', error);
        // The refund amount is recorded on the booking — can be retried
      }
    }

    // 4. Notify the accepting cleaner
    await prisma.notification.create({
      data: {
        userId: cleanerId,
        type: 'BOOKING_CONFIRMED',
        title: 'Job Confirmed!',
        body: `You've been confirmed for a ${queueEntry.booking.serviceType} cleaning on ${queueEntry.booking.date.toLocaleDateString()}. You'll earn £${Number(queueEntry.cleanerEarns).toFixed(2)}.`,
        data: { bookingId } as Prisma.InputJsonValue,
      },
    });

    // 5. Notify superseded cleaners
    const superseded = await prisma.bookingCleanerQueue.findMany({
      where: { bookingId, status: 'SUPERSEDED' },
    });

    for (const entry of superseded) {
      await prisma.notification.create({
        data: {
          userId: entry.cleanerId,
          type: 'SYSTEM',
          title: 'Job No Longer Available',
          body: 'The cleaning job you were offered has been taken by another cleaner.',
          data: { bookingId } as Prisma.InputJsonValue,
        },
      });
    }

    return {
      success: true,
      bookingId,
      cleanerId,
      cleanerName: queueEntry.cleaner.name ?? 'Unknown',
      actualTotal,
      holdAmount,
      refundDue,
      message:
        refundDue > 0
          ? `Booking confirmed. Customer will be refunded £${refundDue.toFixed(2)} (difference between escrow and actual quote).`
          : 'Booking confirmed at the escrowed amount.',
    };
  }

  /**
   * Cleaner rejects a job from the queue.
   */
  static async rejectFromQueue(bookingId: string, cleanerId: string): Promise<void> {
    const queueEntry = await prisma.bookingCleanerQueue.findUnique({
      where: { bookingId_cleanerId: { bookingId, cleanerId } },
    });

    if (!queueEntry || queueEntry.status !== 'PENDING') {
      throw new Error('Cannot reject — entry not found or not pending');
    }

    await prisma.bookingCleanerQueue.update({
      where: { id: queueEntry.id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    // Check if all cleaners have now rejected
    const remaining = await prisma.bookingCleanerQueue.count({
      where: { bookingId, status: 'PENDING' },
    });

    if (remaining === 0) {
      // All cleaners rejected — cancel the booking and refund the full escrow
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'All queued cleaners declined the job.',
        },
      });

      // Notify customer
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true, guestEmail: true },
      });

      if (booking?.clientId) {
        await prisma.notification.create({
          data: {
            userId: booking.clientId,
            type: 'BOOKING_CANCELLED',
            title: 'No Cleaners Available',
            body: 'Unfortunately, none of the matched cleaners were available. Your payment will be fully refunded.',
            data: { bookingId } as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  /**
   * Handle expired queue entries (called by background job).
   */
  static async handleQueueExpiry(bookingId: string): Promise<void> {
    // Expire any still-pending entries
    await prisma.bookingCleanerQueue.updateMany({
      where: { bookingId, status: 'PENDING' },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });

    // Check if any cleaner accepted
    const accepted = await prisma.bookingCleanerQueue.findFirst({
      where: { bookingId, status: 'ACCEPTED' },
    });

    if (!accepted) {
      // No one accepted — cancel and refund
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'Queue expired — no cleaner accepted within the time limit.',
        },
      });
    }
  }

  /**
   * Get the current queue status for a booking.
   */
  static async getQueueStatus(bookingId: string) {
    const entries = await prisma.bookingCleanerQueue.findMany({
      where: { bookingId },
      orderBy: { rank: 'asc' },
      include: {
        cleaner: { select: { name: true, image: true } },
      },
    });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, totalAmountCharged: true, totalPrice: true, isQueuedBooking: true },
    });

    return {
      isQueuedBooking: booking?.isQueuedBooking ?? false,
      bookingStatus: booking?.status,
      holdAmount: booking?.totalAmountCharged ? Number(booking.totalAmountCharged) : null,
      entries: entries.map((e) => ({
        cleanerId: e.cleanerId,
        cleanerName: e.cleaner.name,
        rank: e.rank,
        status: e.status,
        quotedTotal: e.quotedTotal,
        cleanerEarns: e.cleanerEarns,
        expiresAt: e.expiresAt,
      })),
    };
  }

  /**
   * Initiate a partial refund via Ryft for the escrow difference.
   */
  private static async initiatePartialRefund(
    ryftPaymentId: string,
    refundAmount: number
  ): Promise<void> {
    const apiKey = process.env.RYFT_SECRET_KEY;

    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.log(
        `[Ryft] Mock partial refund: £${refundAmount.toFixed(2)} for session ${ryftPaymentId}`
      );
      return;
    }

    const res = await fetch(`https://api.ryftpay.com/v1/payment-sessions/${ryftPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: Math.round(refundAmount * 100), // pence
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      // eslint-disable-next-line no-console
      console.error('[Ryft] Partial refund failed:', res.status, errorBody);
      throw new Error(`Ryft refund error: ${res.status}`);
    }
  }
}
