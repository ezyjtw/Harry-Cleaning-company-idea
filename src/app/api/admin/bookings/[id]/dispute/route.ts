import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { AdminOperationsService } from '@/lib/services/admin-operations.service';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_OUTCOMES = ['release-to-cleaner', 'refund-customer', 'split'] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

// POST /api/admin/bookings/[id]/dispute
//   { outcome, resolution, refundAmount? }
//
// outcome:
//   "release-to-cleaner" → full pay to cleaner, no refund
//   "refund-customer"    → full refund, no pay
//   "split"              → partial refund (refundAmount required), release remainder
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id: bookingId } = await context.params;

  let body: { outcome?: unknown; resolution?: unknown; refundAmount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { outcome, resolution, refundAmount } = body;

  if (!outcome || !VALID_OUTCOMES.includes(outcome as Outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` },
      { status: 400 }
    );
  }

  if (!resolution || typeof resolution !== 'string' || (resolution as string).trim().length === 0) {
    return NextResponse.json({ error: 'resolution is required' }, { status: 400 });
  }

  if (outcome === 'split') {
    if (typeof refundAmount !== 'number' || Number.isNaN(refundAmount) || refundAmount <= 0) {
      return NextResponse.json(
        { error: 'refundAmount (positive number) is required for a split outcome' },
        { status: 400 }
      );
    }
  }

  // Look up the dispute by booking id (the route uses the booking id, not the
  // dispute id, because the admin is navigating from the booking detail page).
  const { prisma } = await import('@/lib/db/prisma');
  const dispute = await prisma.dispute.findUnique({
    where: { bookingId },
    select: { id: true },
  });
  if (!dispute) {
    return NextResponse.json({ error: 'No dispute found on this booking' }, { status: 404 });
  }

  try {
    const result = await AdminOperationsService.resolveDispute({
      disputeId: dispute.id,
      outcome: outcome as Outcome,
      resolution: (resolution as string).trim(),
      refundAmount: typeof refundAmount === 'number' ? refundAmount : undefined,
      adminId: admin.id,
    });

    return NextResponse.json({
      message: 'Dispute resolved',
      outcome: result.outcome,
      refundedAmount: result.refundedAmount,
      refundStatus: result.refundStatus,
      releaseStatus: result.releaseStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Resolve failed' },
      { status: 400 }
    );
  }
}
