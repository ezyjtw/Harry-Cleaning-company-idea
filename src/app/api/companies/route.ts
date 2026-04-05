import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // The authenticated user is the owner — don't trust ownerId from the body
    const ownerId = user.id;

    // Verify owner doesn't already own a company
    const existing = await prisma.company.findFirst({
      where: { ownerId },
    });

    if (existing) {
      return NextResponse.json({ error: 'You already own a company' }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        ownerId,
        name: body.name,
        description: body.description || null,
        logo: body.logo || null,
        website: body.website || null,
        phone: body.phone || null,
        email: body.email || null,
        registrationNumber: body.registrationNumber || null,
        operatingAreas: body.operatingAreas || [],
        specialties: body.specialties || [],
      },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ message: 'Company created successfully', company }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating company:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const mine = searchParams.get('mine');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (status) {
      where.verificationStatus = status;
    }

    // Non-admin users can only see their own company unless browsing public listings
    if (mine === 'true' || user.role !== 'ADMIN') {
      where.ownerId = user.id;
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { team: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error listing companies:', error);
    return NextResponse.json({ error: 'Failed to list companies' }, { status: 500 });
  }
}
