import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import type { DisputeStatus } from '@/lib/types';
import DisputesList from './DisputesList';
import type { AdminDispute } from './DisputesList';

// Map Prisma DisputeStatus enum values to UI status strings
function mapPrismaStatus(prismaStatus: string): DisputeStatus {
  switch (prismaStatus) {
    case 'OPEN':
      return 'open';
    case 'UNDER_REVIEW':
      return 'under-review';
    case 'RESOLVED':
      return 'resolved-customer'; // Default resolved mapping
    case 'DISMISSED':
      return 'resolved-cleaner'; // Dismissed maps to resolved for cleaner
    default:
      return 'open';
  }
}

// Map UI status strings back to Prisma DisputeStatus enum values
function mapUiStatusToPrisma(uiStatus: DisputeStatus): string {
  switch (uiStatus) {
    case 'open':
      return 'OPEN';
    case 'under-review':
      return 'UNDER_REVIEW';
    case 'escalated':
      return 'UNDER_REVIEW'; // Escalated maps to UNDER_REVIEW in Prisma
    case 'resolved-customer':
      return 'RESOLVED';
    case 'resolved-cleaner':
      return 'DISMISSED';
    case 'resolved-split':
      return 'RESOLVED';
    default:
      return 'OPEN';
  }
}

async function getDisputes(): Promise<AdminDispute[]> {
  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      booking: {
        include: {
          client: { select: { name: true, role: true } },
          cleaner: { select: { name: true } },
        },
      },
      raisedBy: { select: { id: true, name: true, role: true } },
    },
  });

  return disputes.map((d) => {
    const isFiledByCleaner = d.raisedBy.role === 'CLEANER';

    // If there's a resolution note containing "split", map to resolved-split
    let status = mapPrismaStatus(d.status);
    if (d.status === 'RESOLVED' && d.resolution?.toLowerCase().includes('split')) {
      status = 'resolved-split';
    }
    if (d.status === 'RESOLVED' && d.resolution?.toLowerCase().includes('cleaner')) {
      status = 'resolved-cleaner';
    }

    return {
      id: d.id.substring(0, 8).toUpperCase(),
      bookingRef: d.booking.id.substring(0, 8).toUpperCase(),
      customerName: d.booking.client?.name || d.booking.guestName || 'Guest',
      cleanerName: d.booking.cleaner.name || 'Unassigned',
      reason: d.reason as AdminDispute['reason'],
      description: d.description,
      dateRaised: d.createdAt.toISOString().split('T')[0],
      status,
      amount: Number(d.booking.totalPrice),
      filedBy: isFiledByCleaner ? 'cleaner' as const : 'customer' as const,
    };
  });
}

export default async function AdminDisputesPage() {
  const disputes = await getDisputes();

  async function resolveDispute(disputeId: string, resolution: DisputeStatus) {
    'use server';

    // The disputeId from the client is the truncated uppercase ID,
    // so we need to find the dispute by prefix match
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: { startsWith: disputeId.toLowerCase() },
      },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    const prismaStatus = mapUiStatusToPrisma(resolution);
    const isResolved = ['RESOLVED', 'DISMISSED'].includes(prismaStatus);

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: prismaStatus as 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED',
        resolution: isResolved ? `Resolved: ${resolution}` : undefined,
        resolvedAt: isResolved ? new Date() : undefined,
      },
    });

    revalidatePath('/admin/disputes');
  }

  return <DisputesList initialDisputes={disputes} resolveAction={resolveDispute} />;
}
