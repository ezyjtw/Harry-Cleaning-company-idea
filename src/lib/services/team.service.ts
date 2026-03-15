import type { TeamMemberRole } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface TeamMemberWithUser {
  id: string;
  companyId: string;
  userId: string;
  role: TeamMemberRole;
  isActive: boolean;
  canAcceptJobs: boolean;
  joinedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface TeamMemberAvailability {
  userId: string;
  name: string | null;
  role: TeamMemberRole;
  isActive: boolean;
  availabilitySlots: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  upcomingBookings: number;
}

// ─── Service ────────────────────────────────────────────────

export class TeamService {
  /**
   * Add a team member to a company.
   */
  static async addTeamMember(
    companyId: string,
    userId: string,
    role: TeamMemberRole = 'CLEANER'
  ): Promise<TeamMemberWithUser> {
    // Verify the company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    // Check user exists and is a cleaner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cleanerProfile: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        companyId,
        userId,
        role,
        isActive: true,
        canAcceptJobs: role === 'CLEANER',
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Link cleaner profile to the company's provider if they have one
    if (user.cleanerProfile && company.provider) {
      await prisma.cleanerProfile.update({
        where: { id: user.cleanerProfile.id },
        data: { providerId: company.provider.id },
      });
    }

    // Update staff count
    await prisma.company.update({
      where: { id: companyId },
      data: { staffCount: { increment: 1 } },
    });

    return teamMember;
  }

  /**
   * Remove a team member from a company.
   */
  static async removeTeamMember(companyId: string, userId: string) {
    const teamMember = await prisma.teamMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.role === 'OWNER') {
      throw new Error('Cannot remove the company owner');
    }

    // Unlink cleaner profile from the provider
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { provider: true },
    });

    if (company?.provider) {
      await prisma.cleanerProfile.updateMany({
        where: { userId, providerId: company.provider.id },
        data: { providerId: null },
      });
    }

    await prisma.teamMember.delete({
      where: { companyId_userId: { companyId, userId } },
    });

    // Update staff count
    await prisma.company.update({
      where: { id: companyId },
      data: { staffCount: { decrement: 1 } },
    });

    return { success: true };
  }

  /**
   * Update a team member's role.
   */
  static async updateTeamMemberRole(companyId: string, userId: string, role: TeamMemberRole) {
    const teamMember = await prisma.teamMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.role === 'OWNER' && role !== 'OWNER') {
      throw new Error('Cannot change the owner role. Transfer ownership first.');
    }

    return prisma.teamMember.update({
      where: { companyId_userId: { companyId, userId } },
      data: {
        role,
        canAcceptJobs: role === 'CLEANER',
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  /**
   * Get all team members for a company.
   */
  static async getTeamMembers(companyId: string): Promise<TeamMemberWithUser[]> {
    return prisma.teamMember.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then MANAGER, then CLEANER
        { joinedAt: 'asc' },
      ],
    });
  }

  /**
   * Get aggregate availability for all active team members.
   */
  static async getTeamMemberAvailability(companyId: string): Promise<TeamMemberAvailability[]> {
    const teamMembers = await prisma.teamMember.findMany({
      where: { companyId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            cleanerProfile: {
              include: {
                availabilitySlots: {
                  select: { dayOfWeek: true, startTime: true, endTime: true },
                  orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    const results = await Promise.all(
      teamMembers.map(async (tm) => {
        const upcomingBookings = await prisma.booking.count({
          where: {
            cleanerId: tm.userId,
            date: { gte: now },
            status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED'] },
          },
        });

        return {
          userId: tm.userId,
          name: tm.user.name,
          role: tm.role,
          isActive: tm.isActive,
          availabilitySlots: tm.user.cleanerProfile?.availabilitySlots ?? [],
          upcomingBookings,
        };
      })
    );

    return results;
  }

  /**
   * Toggle a team member's active status.
   */
  static async toggleTeamMemberActive(companyId: string, userId: string, isActive: boolean) {
    const teamMember = await prisma.teamMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!teamMember) {
      throw new Error('Team member not found');
    }

    if (teamMember.role === 'OWNER' && !isActive) {
      throw new Error('Cannot deactivate the company owner');
    }

    return prisma.teamMember.update({
      where: { companyId_userId: { companyId, userId } },
      data: {
        isActive,
        canAcceptJobs: isActive ? teamMember.canAcceptJobs : false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }
}
