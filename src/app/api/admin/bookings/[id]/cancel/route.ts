import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { AdminOperationsService } from '@/lib/services/admin-operations.service';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/bookings/[id]/cancel
//   { reason }                 → cancel + default 100% refund (of the remainder)
//   { reason, refundAmount }   → cancel + explicit refund override (capped at remainder)
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { reason?: unknown; refundAmount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reason, refundAmount } = body;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  let overrideAmount: number | undefined;
  if (refundAmount !== undefined && refundAmount !== null) {
    if (typeof refundAmount !== 'number' || Number.isNaN(refundAmount) || refundAmount < 0) {
      return NextResponse.json(
        { error: 'refundAmount must be a non-negative number' },
        { status: 400 }
      );
    }
    overrideAmount = refundAmount;
  }

  try {
    const result = await AdminOperationsService.adminCancelBooking(
      id,
      reason.trim(),
      admin.id,
      overrideAmount
    );
    return NextResponse.json({
      message: 'Booking cancelled',
      refundPercent: result.refundPercent,
      refundAmount: result.refundAmount,
      refundStatus: result.refundStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cancel failed' },
      { status: 400 }
    );
  }
}
