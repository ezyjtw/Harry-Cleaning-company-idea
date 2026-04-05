import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { CompanyService } from '@/lib/services/company.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.bookingId || !body.cleanerId) {
      return NextResponse.json({ error: 'bookingId and cleanerId are required' }, { status: 400 });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const updated = await CompanyService.assignBookingToTeamMember(body.bookingId, body.cleanerId);
    return NextResponse.json({ booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: { provider: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!company.provider) {
      return NextResponse.json({
        bookings: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { providerId: company.provider.id };
    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          client: { select: { id: true, name: true, email: true } },
          cleaner: { select: { id: true, name: true, email: true } },
          address: true,
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching company bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch company bookings' }, { status: 500 });
  }
}
