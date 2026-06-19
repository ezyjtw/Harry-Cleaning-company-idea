import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { AdminOperationsService } from '@/lib/services/admin-operations.service';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/bookings/[id]/reassign
//   { newCleanerId, dryRun: true }            → read-only price preview
//   { newCleanerId, reason }                  → perform the reassign
//
// Never force-charges the customer. Pricier reassigns send a top-up approval;
// equal/cheaper are applied directly (cheaper refunds the difference).
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { newCleanerId?: unknown; reason?: unknown; dryRun?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { newCleanerId, reason, dryRun } = body;

  if (!newCleanerId || typeof newCleanerId !== 'string') {
    return NextResponse.json({ error: 'newCleanerId is required' }, { status: 400 });
  }

  try {
    if (dryRun === true) {
      const preview = await AdminOperationsService.previewReassign(id, newCleanerId);
      return NextResponse.json({ preview });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const result = await AdminOperationsService.reassignBooking(
      id,
      newCleanerId,
      reason.trim(),
      admin.id
    );
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reassign failed' },
      { status: 400 }
    );
  }
}
