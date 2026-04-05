import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { TeamService } from '@/lib/services/team.service';

type RouteContext = { params: Promise<{ id: string; userId: string }> };

/**
 * PATCH /api/companies/[id]/team/[userId]
 * Update a team member's role or active status.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, userId } = await context.params;
    const body = await request.json();

    if (body.role !== undefined) {
      const updated = await TeamService.updateTeamMemberRole(id, userId, body.role);
      return NextResponse.json({ member: updated });
    }

    if (body.isActive !== undefined) {
      const updated = await TeamService.toggleTeamMemberActive(id, userId, body.isActive);
      return NextResponse.json({ member: updated });
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update team member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/companies/[id]/team/[userId]
 * Remove a team member from the company.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id, userId } = await context.params;
    await TeamService.removeTeamMember(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove team member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
