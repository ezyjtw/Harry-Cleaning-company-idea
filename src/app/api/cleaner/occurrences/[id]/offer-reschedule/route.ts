import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';

// R10 Lane 2 (James-ruled): a cleaner OFFERS a one-off time change for a
// single occurrence of a repeat booking. The customer chooses (R1-C law);
// nothing moves until she accepts.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCleanerSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { offerReschedule } = await import('@/lib/services/reschedule-offer.service');
  const result = await offerReschedule({
    bookingId: id,
    cleanerId: user.id,
    proposedDate: typeof body?.proposedDate === 'string' ? body.proposedDate : '',
    proposedTime: typeof body?.proposedTime === 'string' ? body.proposedTime : '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    offerId: result.offerId,
    expiresAt: result.expiresAt,
    message:
      'The customer has been asked. If she accepts, just this visit moves. If she declines or does not answer, it stays as it is.',
  });
}
