import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getSessionUser } from '@/lib/auth/session';

/**
 * GET /api/companies/mine
 * Returns the company owned by the current authenticated user,
 * or the company they are a team member of.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    // Check if user owns a company
    let company = await prisma.company.findFirst({
      where: { ownerId: user.id, isActive: true },
      include: {
        provider: true,
        _count: { select: { team: true } },
      },
    });

    // If not an owner, check if they're a team member
    if (!company) {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id },
        include: {
          company: {
            include: {
              provider: true,
              _count: { select: { team: true } },
            },
          },
        },
      });
      if (membership?.company?.isActive) {
        company = membership.company;
      }
    }

    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
