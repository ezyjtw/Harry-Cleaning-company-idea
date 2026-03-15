import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['bookingId', 'filedById', 'category', 'subject', 'description'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: body.filedById },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const complaint = await prisma.complaint.create({
      data: {
        bookingId: body.bookingId,
        filedById: body.filedById,
        category: body.category,
        severity: body.severity || 'MEDIUM',
        subject: body.subject,
        description: body.description,
      },
      include: {
        booking: { select: { id: true, serviceType: true, date: true, status: true } },
        filedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      { message: 'Complaint filed successfully', complaint },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error filing complaint:', error);
    return NextResponse.json({ error: 'Failed to file complaint' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (severity) where.severity = severity;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: { select: { id: true, serviceType: true, date: true } },
          filedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { evidence: true } },
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return NextResponse.json({
      complaints,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error listing complaints:', error);
    return NextResponse.json({ error: 'Failed to list complaints' }, { status: 500 });
  }
}
