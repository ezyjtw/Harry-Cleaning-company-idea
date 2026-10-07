import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { handleDecline } from '@/lib/services/cascade.service';

type RouteContext = { params: Promise<{ id: string }> };

const DECLINE_REASONS = ['too_far', 'bad_time', 'pay_too_low', 'other'] as const;

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // Optional decline reason from the shell's bottom sheet ([{cleanerId,
  // reason, at}] on Booking.declineReasons, for cascade analytics). Invalid
  // values are ignored. B3 (RENA-028): the reason is now written in the same
  // guarded statement as the decline itself, never as a separate
  // read-modify-write.
  const body = await request.json().catch(() => null);
  const raw = body?.reason;
  const reason =
    typeof raw === 'string' && (DECLINE_REASONS as readonly string[]).includes(raw)
      ? raw
      : undefined;

  const result = await handleDecline(id, user.id, reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({ message: result.message });
}
