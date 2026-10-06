import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isReportReason, type ReportTarget } from '@/lib/reports';
import { handleApiError, ValidationError } from '@/lib/utils/errors';

// POST /api/reports — a user-filed report of a REVIEW or of a whole CONVERSATION
// partner (UGC report, James-ordered). Admin-visible in the HQ Reports room.
// Never changes review visibility or publication timing on its own.
//   { target: 'REVIEW', reviewId, reason, details? }
//   { target: 'CONVERSATION', partnerId, reason, details? }
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to report.' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const limit = checkRateLimit(`ugc-report:${user.id}:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many reports in the last hour. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const target = body?.target as ReportTarget;
    if (target !== 'REVIEW' && target !== 'CONVERSATION') {
      throw new ValidationError('target must be REVIEW or CONVERSATION.');
    }
    if (!isReportReason(body?.reason, target)) {
      throw new ValidationError('A valid reason is required.');
    }
    const details =
      typeof body?.details === 'string' && body.details.trim()
        ? body.details.trim().substring(0, 1000)
        : null;

    let reportedUserId: string;
    let reviewId: string | null = null;
    let bookingId: string | null = null;

    if (target === 'REVIEW') {
      if (!body?.reviewId || typeof body.reviewId !== 'string') {
        throw new ValidationError('reviewId is required.');
      }
      const review = await prisma.review.findUnique({
        where: { id: body.reviewId },
        select: { id: true, clientId: true, bookingId: true, visibility: true },
      });
      if (!review || review.visibility !== 'VISIBLE') {
        return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
      }
      if (review.clientId === user.id) {
        throw new ValidationError('You cannot report your own review.');
      }
      reportedUserId = review.clientId;
      reviewId = review.id;
      bookingId = review.bookingId;
    } else {
      if (!body?.partnerId || typeof body.partnerId !== 'string') {
        throw new ValidationError('partnerId is required.');
      }
      if (body.partnerId === user.id) {
        throw new ValidationError('You cannot report yourself.');
      }
      // Scoped like block: only someone you share (or shared) a booking with.
      const shared = await prisma.booking.findFirst({
        where: {
          OR: [
            { clientId: user.id, cleanerId: body.partnerId },
            { clientId: body.partnerId, cleanerId: user.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!shared) {
        return NextResponse.json(
          { error: 'You can only report someone you have a booking with.' },
          { status: 403 }
        );
      }
      reportedUserId = body.partnerId;
      bookingId = shared.id;
    }

    // One open report per reporter per item.
    const existing = await prisma.contentReport.findFirst({
      where: {
        reporterId: user.id,
        target,
        status: 'OPEN',
        ...(target === 'REVIEW' ? { reviewId } : { reportedUserId }),
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ reported: true, alreadyReported: true });
    }

    await prisma.contentReport.create({
      data: {
        target,
        reporterId: user.id,
        reportedUserId,
        reviewId,
        bookingId,
        reason: body.reason,
        details,
      },
    });

    return NextResponse.json({ reported: true });
  } catch (error) {
    return handleApiError(error);
  }
}
