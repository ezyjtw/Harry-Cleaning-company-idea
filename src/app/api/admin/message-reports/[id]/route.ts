import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// PATCH /api/admin/message-reports/[id] { action: 'ACTION' | 'DISMISS', adminNotes? }
// Resolve a message report (admin only).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const { action, adminNotes } = await request.json();

    if (action !== 'ACTION' && action !== 'DISMISS') {
      return NextResponse.json({ error: 'action must be "ACTION" or "DISMISS".' }, { status: 400 });
    }
    if (adminNotes && typeof adminNotes === 'string' && adminNotes.length > 1000) {
      return NextResponse.json(
        { error: 'adminNotes must be 1000 characters or fewer.' },
        { status: 400 }
      );
    }

    const report = await prisma.messageReport.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    if (report.status !== 'OPEN') {
      return NextResponse.json(
        { error: `Report has already been ${report.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const updated = await prisma.messageReport.update({
      where: { id: params.id },
      data: {
        status: action === 'ACTION' ? 'ACTIONED' : 'DISMISSED',
        reviewedById: admin.id,
        reviewedAt: new Date(),
        adminNotes:
          typeof adminNotes === 'string' && adminNotes.trim()
            ? adminNotes.trim().substring(0, 1000)
            : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      message: action === 'ACTION' ? 'Report actioned.' : 'Report dismissed.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
