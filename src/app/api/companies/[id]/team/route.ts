import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser, getCompanyMemberSession } from '@/lib/auth/session';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const user = await getCompanyMemberSession(id);
    if (!user) {
      return NextResponse.json({ error: 'Access denied. You must be a member of this company.' }, { status: 403 });
    }

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

    // Only company owner or admin can add team members
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (company.ownerId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only the company owner can add team members.' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!targetUser) {
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
