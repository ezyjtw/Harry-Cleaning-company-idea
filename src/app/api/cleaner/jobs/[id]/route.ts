import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const validActions = ['accept', 'reject', 'check-in', 'complete', 'add-notes'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (body.action) {
      case 'accept':
        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
          return NextResponse.json(
            { error: 'Booking cannot be accepted in its current status' },
            { status: 400 }
          );
        }
        updateData = { status: 'ACCEPTED', acceptedAt: new Date() };
        break;

      case 'reject':
        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
          return NextResponse.json(
            { error: 'Booking cannot be rejected in its current status' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: body.reason || 'Rejected by cleaner',
        };
        break;

      case 'check-in':
        if (booking.status !== 'ACCEPTED' && booking.status !== 'EN_ROUTE') {
          return NextResponse.json({ error: 'Cannot check in for this booking' }, { status: 400 });
        }
        updateData = {
          status: 'IN_PROGRESS',
          checkedInAt: new Date(),
          arrivalConfirmed: true,
        };
        break;

      case 'complete':
        if (booking.status !== 'IN_PROGRESS') {
          return NextResponse.json({ error: 'Booking is not in progress' }, { status: 400 });
        }
        updateData = {
          status: 'COMPLETED',
          completedAt: new Date(),
          checklistCompleted: body.checklistCompleted ?? true,
          cleanerNotes: body.notes || booking.cleanerNotes,
        };
        break;

      case 'add-notes':
        updateData = {
          cleanerNotes: body.notes,
        };
        if (!body.notes) {
          return NextResponse.json(
            { error: 'notes is required for add-notes action' },
            { status: 400 }
          );
        }
        break;
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        address: true,
      },
    });

    return NextResponse.json({
      message: `Job ${body.action} successful`,
      booking: updated,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}
