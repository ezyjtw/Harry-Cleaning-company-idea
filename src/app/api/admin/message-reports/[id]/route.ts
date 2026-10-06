import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

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
      select: { status: true, reportedUserId: true, messageId: true },
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

    // Audit the moderation decision (which admin, when, action, notes) — best-effort
    // so an audit failure can't 500 an already-committed resolution.
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    AuditService.log({
      userId: admin.id,
      action: action === 'ACTION' ? 'MESSAGE_REPORT_ACTIONED' : 'MESSAGE_REPORT_DISMISSED',
      entityType: 'MessageReport',
      entityId: params.id,
      metadata: {
        reportedUserId: report.reportedUserId,
        messageId: report.messageId,
        ...(updated.adminNotes ? { adminNotes: updated.adminNotes } : {}),
      },
      ipAddress,
    }).catch(() => {});

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      message: action === 'ACTION' ? 'Report actioned.' : 'Report dismissed.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
