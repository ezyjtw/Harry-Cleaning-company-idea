import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CleanerQueueService } from '@/lib/services/cleaner-queue.service';

/**
 * POST /api/bookings/queue/reject
 *
 * Cleaner rejects a job from the top-3 queue.
 * If all cleaners reject, the booking is cancelled and escrow refunded.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.bookingId || !body.cleanerId) {
    return NextResponse.json({ error: 'bookingId and cleanerId are required' }, { status: 400 });
  }

  try {
    await CleanerQueueService.rejectFromQueue(body.bookingId, body.cleanerId);

    return NextResponse.json({
      success: true,
      message: 'Job declined. Other cleaners may still accept.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject job';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
