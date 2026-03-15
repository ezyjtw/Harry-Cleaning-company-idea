import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        team: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        _count: { select: { team: true } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching company:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        logo: body.logo ?? existing.logo,
        website: body.website ?? existing.website,
        phone: body.phone ?? existing.phone,
        email: body.email ?? existing.email,
        registrationNumber: body.registrationNumber ?? existing.registrationNumber,
        operatingAreas: body.operatingAreas ?? existing.operatingAreas,
        specialties: body.specialties ?? existing.specialties,
      },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ message: 'Company updated', company });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    await prisma.company.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Company deactivated' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deactivating company:', error);
    return NextResponse.json({ error: 'Failed to deactivate company' }, { status: 500 });
  }
}
