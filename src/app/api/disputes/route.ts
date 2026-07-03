import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import type { DisputeReason, DisputeStatus } from '@/lib/types';

// Map the Prisma DisputeStatus enum onto the client-facing union used by
// getDisputeStatusLabel. Mirrors the admin page's mapping — display only, no
// lifecycle change. RESOLVED/DISMISSED refine via the resolution note.
function mapPrismaStatus(status: string, resolution: string | null): DisputeStatus {
  switch (status) {
    case 'UNDER_REVIEW':
      return 'under-review';
    case 'RESOLVED': {
      const note = resolution?.toLowerCase() ?? '';
      if (note.includes('split')) return 'resolved-split';
      if (note.includes('cleaner')) return 'resolved-cleaner';
      return 'resolved-customer';
    }
    case 'DISMISSED':
      return 'resolved-cleaner';
    case 'OPEN':
    default:
      return 'open';
  }
}

// Label an evidence uploader by their role on the booking. Neither party →
// "Rena team" (admin/support upload). Display-only.
function labelUploader(
  uploaderId: string,
  clientId: string | null,
  cleanerId: string
): 'customer' | 'cleaner' | 'Rena team' {
  if (uploaderId === clientId) return 'customer';
  if (uploaderId === cleanerId) return 'cleaner';
  return 'Rena team';
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    // A user's disputes = disputes on bookings where they are the client or the
    // cleaner. (Filing stays client-only; viewing/adding evidence is either party.)
    const disputes = await prisma.dispute.findMany({
      where: {
        booking: { OR: [{ clientId: user.id }, { cleanerId: user.id }] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        evidence: { orderBy: { uploadedAt: 'asc' } },
        raisedBy: { select: { name: true, role: true } },
        booking: { select: { id: true, clientId: true, cleanerId: true } },
      },
    });

    const mapped = disputes.map((d) => ({
      id: d.id,
      bookingId: d.booking.id,
      filedBy: d.raisedBy.role === 'CLEANER' ? ('cleaner' as const) : ('customer' as const),
      filedByName: d.raisedBy.name || 'A party',
      reason: d.reason as DisputeReason,
      description: d.description,
      status: mapPrismaStatus(d.status, d.resolution),
      createdAt: d.createdAt.toISOString(),
      evidence: d.evidence.map((ev) => ({
        id: ev.id,
        type: ev.type,
        fileName: ev.fileName ?? undefined,
        description: ev.description ?? ev.fileName ?? '',
        uploadedAt: ev.uploadedAt.toISOString(),
        // Label the uploader by their role on the booking; an uploader who is
        // neither party (admin/support) shows as "Rena team".
        uploadedBy: labelUploader(ev.uploadedBy, d.booking.clientId, d.booking.cleanerId),
        // Viewer route (evidence is encrypted at rest — no raw presigned URL).
        url: `/api/disputes/${d.id}/evidence/${ev.id}`,
      })),
    }));

    return NextResponse.json({ disputes: mapped });
  } catch {
    return NextResponse.json({ error: 'Failed to load disputes.' }, { status: 500 });
  }
}
