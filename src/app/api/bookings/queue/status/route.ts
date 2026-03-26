import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CleanerQueueService } from '@/lib/services/cleaner-queue.service';

/**
 * GET /api/bookings/queue/status?bookingId=xxx
 *
 * Get the current state of the top-3 cleaner queue for a booking.
 */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('bookingId');

  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  try {
    const status = await CleanerQueueService.getQueueStatus(bookingId);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get queue status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
