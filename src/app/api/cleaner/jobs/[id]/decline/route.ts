import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { handleDecline } from '@/lib/services/cascade.service';

type RouteContext = { params: Promise<{ id: string }> };

const DECLINE_REASONS = ['too_far', 'bad_time', 'pay_too_low', 'other'] as const;

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // B3: optional decline reason from the shell's bottom sheet — appended to
  // Booking.declineReasons ([{cleanerId, reason, at}]) for cascade analytics.
  // Best-effort BEFORE the decline (never blocks it); invalid values ignored.
  try {
    const body = await request.json().catch(() => null);
    const reason = body?.reason;
    if (typeof reason === 'string' && (DECLINE_REASONS as readonly string[]).includes(reason)) {
      const existing = await prisma.booking.findUnique({
        where: { id },
        select: { declineReasons: true },
      });
      const list = Array.isArray(existing?.declineReasons) ? existing.declineReasons : [];
      await prisma.booking.update({
        where: { id },
        data: {
          declineReasons: [
            ...(list as object[]),
            { cleanerId: user.id, reason, at: new Date().toISOString() },
          ],
        },
      });
    }
  } catch {
    /* analytics only — the decline itself must always proceed */
  }

  const result = await handleDecline(id, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({ message: result.message });
}
