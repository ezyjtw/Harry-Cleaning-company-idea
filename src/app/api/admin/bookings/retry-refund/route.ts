import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import stripe from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json();
  const { refundRecordId } = body;

  if (!refundRecordId || typeof refundRecordId !== 'string') {
    return NextResponse.json({ error: 'refundRecordId is required' }, { status: 400 });
  }

  const refundRecord = await prisma.refundRecord.findUnique({
    where: { id: refundRecordId },
    include: {
      booking: {
        select: {
          id: true,
          stripePaymentIntentId: true,
          transferStatus: true,
          paymentStatus: true,
          totalPrice: true,
          payment: { select: { id: true } },
          refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
        },
      },
    },
  });

  if (!refundRecord) {
    return NextResponse.json({ error: 'RefundRecord not found' }, { status: 404 });
  }

  if (refundRecord.status !== 'REVERSAL_ONLY') {
    return NextResponse.json(
      { error: `Cannot retry — record status is ${refundRecord.status}, not REVERSAL_ONLY` },
      { status: 400 }
    );
  }

  const booking = refundRecord.booking;

  if (booking.transferStatus !== 'REFUNDING') {
    return NextResponse.json(
      { error: `Unexpected transferStatus: ${booking.transferStatus}. Expected REFUNDING.` },
      { status: 400 }
    );
  }

  if (!booking.stripePaymentIntentId) {
    return NextResponse.json({ error: 'No payment intent on booking' }, { status: 400 });
  }

  const amountPounds = Number(refundRecord.amount);
  const amountPence = Math.round(amountPounds * 100);
  const newAttempt = refundRecord.attempt + 1;
  const idempotencyKey = `refund_${refundRecord.id}_v${newAttempt}`;

  const alreadyRefunded = booking.refundRecords.reduce(
    (sum: number, r: { amount: unknown }) => sum + Number(r.amount),
    0
  );
  const totalPaid = Number(booking.totalPrice);
  const isFullRefund = Math.abs(amountPounds - (totalPaid - alreadyRefunded)) < 0.01;

  try {
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: booking.stripePaymentIntentId,
        amount: amountPence,
        metadata: { bookingId: booking.id, refundRecordId: refundRecord.id },
      },
      { idempotencyKey }
    );

    const previouslyRefunded = alreadyRefunded;
    const newRefundTotal = Math.round((previouslyRefunded + amountPounds) * 100) / 100;

    const nextTransferStatus = isFullRefund ? 'REFUNDED' : 'RELEASED';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = [
      prisma.refundRecord.update({
        where: { id: refundRecord.id },
        data: {
          stripeRefundId: stripeRefund.id,
          status: 'SUCCEEDED',
          attempt: newAttempt,
          failureReason: null,
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          transferStatus: nextTransferStatus,
        },
      }),
    ];

    if (booking.payment) {
      ops.push(
        prisma.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundAmount: newRefundTotal,
          },
        })
      );
    }

    await prisma.$transaction(ops);

    await AuditService.log({
      userId: admin.id,
      action: 'ADMIN_RETRY_STUCK_REFUND',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: {
        refundRecordId: refundRecord.id,
        amount: amountPounds,
        stripeRefundId: stripeRefund.id,
        isFullRefund,
        previousStatus: 'REVERSAL_ONLY',
      },
    }).catch(() => {});

    return NextResponse.json({
      status: 'SUCCEEDED',
      stripeRefundId: stripeRefund.id,
      amountRefunded: amountPounds,
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';

    await prisma.refundRecord.update({
      where: { id: refundRecord.id },
      data: { attempt: newAttempt, failureReason: `Retry failed: ${reason}` },
    });

    return NextResponse.json(
      { error: `Customer refund failed: ${reason}`, status: 'FAILED' },
      { status: 500 }
    );
  }
}
