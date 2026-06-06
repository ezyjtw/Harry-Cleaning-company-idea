import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CleanerQueueService } from '@/lib/services/cleaner-queue.service';

/**
 * POST /api/bookings/queue/accept
 *
 * Cleaner accepts a job from the top-3 queue.
 * If their quote is lower than the escrow amount, a partial refund is initiated.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.bookingId || !body.cleanerId) {
    return NextResponse.json({ error: 'bookingId and cleanerId are required' }, { status: 400 });
  }

  try {
    const result = await CleanerQueueService.acceptFromQueue(body.bookingId, body.cleanerId);

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      cleanerName: result.cleanerName,
      actualTotal: result.actualTotal,
      holdAmount: result.holdAmount,
      refundDue: result.refundDue,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept job';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
