import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// GET /api/admin/message-reports — open message reports queue (admin only).
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const reports = await prisma.messageReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        message: { select: { content: true, createdAt: true } },
        reporter: { select: { name: true, email: true } },
        reportedUser: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        origin: r.origin,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        bookingId: r.bookingId,
        messageContent: r.message.content,
        messageAt: r.message.createdAt,
        // reporter is null for SYSTEM (auto-flagged) reports.
        reporterName: r.reporter?.name ?? null,
        reporterEmail: r.reporter?.email ?? null,
        reportedName: r.reportedUser.name,
        reportedEmail: r.reportedUser.email,
      })),
      count: reports.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
