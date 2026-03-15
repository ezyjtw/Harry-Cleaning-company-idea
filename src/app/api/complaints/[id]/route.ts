import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        booking: {
          select: { id: true, serviceType: true, date: true, status: true, totalPrice: true },
        },
        filedBy: { select: { id: true, name: true, email: true } },
        evidence: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    return NextResponse.json({ complaint });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching complaint:', error);
    return NextResponse.json({ error: 'Failed to fetch complaint' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (!body.status || !['RESOLVED', 'DISMISSED'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be RESOLVED or DISMISSED' }, { status: 400 });
    }

    const complaint = await prisma.complaint.update({
      where: { id },
      data: {
        status: body.status,
        resolution: body.resolution || null,
        refundAmount: body.refundAmount ?? null,
        isRedoClean: body.isRedoClean ?? false,
        resolvedAt: new Date(),
      },
      include: {
        booking: { select: { id: true, serviceType: true, date: true } },
        filedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      message: `Complaint ${body.status.toLowerCase()}`,
      complaint,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating complaint:', error);
    return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
  }
}
