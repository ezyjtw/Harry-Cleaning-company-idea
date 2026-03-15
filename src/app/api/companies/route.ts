import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['ownerId', 'name'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Verify owner exists and doesn't already own a company
    const owner = await prisma.user.findUnique({
      where: { id: body.ownerId },
      include: { ownedCompany: true },
    });

    if (!owner) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (owner.ownedCompany) {
      return NextResponse.json({ error: 'User already owns a company' }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        ownerId: body.ownerId,
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (status) {
      where.verificationStatus = status;
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
