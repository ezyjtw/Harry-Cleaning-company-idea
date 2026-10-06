import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

// PATCH /api/admin/reports/[id] { resolution } — resolve a review or
// conversation report WITH a written reason (the HQ grammar: resolve with
// reason, never a bare dismiss). Resolving a report changes nothing else:
// no review is hidden, no account is touched, by this call.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const resolution = typeof body?.resolution === 'string' ? body.resolution.trim() : '';
    if (resolution.length < 3) {
      return NextResponse.json({ error: 'A resolution reason is required.' }, { status: 400 });
    }
    if (resolution.length > 1000) {
      return NextResponse.json(
        { error: 'resolution must be 1000 characters or fewer.' },
        { status: 400 }
      );
    }

    const report = await prisma.contentReport.findUnique({
      where: { id: params.id },
      select: { status: true, target: true, reportedUserId: true, reviewId: true },
    });
    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }
    if (report.status !== 'OPEN') {
      return NextResponse.json({ error: 'Report has already been resolved.' }, { status: 400 });
    }

    const updated = await prisma.contentReport.update({
      where: { id: params.id },
      data: {
        status: 'RESOLVED',
        resolvedById: admin.id,
        resolvedAt: new Date(),
        resolution,
      },
    });

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    AuditService.log({
      userId: admin.id,
      action: 'CONTENT_REPORT_RESOLVED',
      entityType: 'ContentReport',
      entityId: params.id,
      metadata: {
        target: report.target,
        reportedUserId: report.reportedUserId,
        ...(report.reviewId ? { reviewId: report.reviewId } : {}),
        resolution,
      },
      ipAddress,
    }).catch(() => {});

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      message: 'Report resolved.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
