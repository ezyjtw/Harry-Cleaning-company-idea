import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';

// R1-C: the cleaner's "Can't make this one" on a single occurrence. Paid →
// existing rescue three-way; unpaid SCHEDULED → the no-charge choice funnel.
// The agreement is untouched either way — the customer chooses what happens.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCleanerSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { cantMakeOccurrence } = await import('@/lib/services/occurrence-rescue.service');
  const result = await cantMakeOccurrence({
    bookingId: id,
    cleanerId: user.id,
    reason: typeof body?.reason === 'string' ? body.reason : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    variant: result.variant,
    message:
      result.variant === 'paid'
        ? 'The customer has been offered a reschedule, cover, or a full refund. Your regular arrangement is unchanged.'
        : 'The customer has been asked to pick a new date or skip this one — nothing was charged. Your regular arrangement is unchanged.',
  });
}
