import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const members = await prisma.teamMember.findMany({
      where: { companyId: id, ...(activeOnly ? { isActive: true } : {}) },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for existing membership
    const existing = await prisma.teamMember.findUnique({
      where: { companyId_userId: { companyId: id, userId: body.userId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
    }

    const member = await prisma.teamMember.create({
      data: {
        companyId: id,
        userId: body.userId,
        role: body.role || 'CLEANER',
        canAcceptJobs: body.canAcceptJobs ?? false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Update company staff count
    await prisma.company.update({
      where: { id },
      data: { staffCount: { increment: 1 } },
    });

    return NextResponse.json({ message: 'Team member added', member }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
