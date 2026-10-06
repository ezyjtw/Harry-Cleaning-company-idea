import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

// GET /api/admin/reports — the open UGC report queue (admin only): review and
// conversation reports (ContentReport) plus the per-message reports
// (MessageReport), one list, oldest first. The HQ Reports room reads the same
// truth server-side; this endpoint exists for tooling and drives.
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const [content, messages] = await Promise.all([
      prisma.contentReport.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
        include: {
          reporter: { select: { name: true, email: true } },
          reportedUser: { select: { name: true, email: true } },
          review: {
            select: {
              text: true,
              rating: true,
              cleaner: { select: { name: true } },
            },
          },
        },
      }),
      prisma.messageReport.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
        include: {
          message: { select: { content: true, createdAt: true } },
          reporter: { select: { name: true, email: true } },
          reportedUser: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      content: content.map((r) => ({
        id: r.id,
        target: r.target,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        bookingId: r.bookingId,
        reviewId: r.reviewId,
        reviewText: r.review?.text ?? null,
        reviewRating: r.review ? Number(r.review.rating) : null,
        reviewAbout: r.review?.cleaner?.name ?? null,
        reporterName: r.reporter.name,
        reporterEmail: r.reporter.email,
        reportedName: r.reportedUser.name,
        reportedEmail: r.reportedUser.email,
      })),
      messages: messages.map((r) => ({
        id: r.id,
        origin: r.origin,
        reason: r.reason,
        details: r.details,
        createdAt: r.createdAt,
        bookingId: r.bookingId,
        messageContent: r.message.content,
        messageAt: r.message.createdAt,
        reporterName: r.reporter?.name ?? null,
        reporterEmail: r.reporter?.email ?? null,
        reportedName: r.reportedUser.name,
        reportedEmail: r.reportedUser.email,
      })),
      count: content.length + messages.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
