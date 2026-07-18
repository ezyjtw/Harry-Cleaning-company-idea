import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { sanitizeInput } from '@/lib/utils/validation';

const MAX_IMPORTED_REVIEWS = 3;

export async function POST(request: Request) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const rl = checkRateLimit(`imported-review-submit:${user.id}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { rating, text, source, reviewerName, evidenceUrl, referenceContacts } = body;

    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      return NextResponse.json({ error: 'Source is required.' }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5.' },
        { status: 400 }
      );
    }

    // Round to 1 decimal place
    const roundedRating = Math.round(rating * 10) / 10;

    // Server-enforce cap: PENDING + VERIFIED count toward the limit
    const existingCount = await prisma.importedReview.count({
      where: {
        cleanerId: user.id,
        verificationStatus: { in: ['PENDING', 'VERIFIED'] },
      },
    });

    if (existingCount >= MAX_IMPORTED_REVIEWS) {
      return NextResponse.json(
        {
          error: `You can import a maximum of ${MAX_IMPORTED_REVIEWS} reviews. You already have ${existingCount}.`,
        },
        { status: 400 }
      );
    }

    // If evidenceUrl is provided, verify it belongs to this cleaner (key pattern check)
    if (evidenceUrl && typeof evidenceUrl === 'string') {
      if (!evidenceUrl.startsWith(`imported-review-evidence/${user.id}/`)) {
        return NextResponse.json({ error: 'Invalid evidence reference.' }, { status: 400 });
      }
    }

    const sanitizedText = text ? sanitizeInput(String(text)).substring(0, 2000) : null;
    const sanitizedSource = sanitizeInput(String(source).trim()).substring(0, 200);
    const sanitizedReviewerName = reviewerName
      ? sanitizeInput(String(reviewerName).trim()).substring(0, 200)
      : null;
    const sanitizedContacts = referenceContacts
      ? sanitizeInput(String(referenceContacts).trim()).substring(0, 1000)
      : null;

    const imported = await prisma.importedReview.create({
      data: {
        cleanerId: user.id,
        rating: roundedRating,
        text: sanitizedText,
        source: sanitizedSource,
        reviewerName: sanitizedReviewerName,
        evidenceUrl: evidenceUrl || null,
        referenceContacts: sanitizedContacts,
        verificationStatus: 'PENDING',
      },
    });

    AuditService.log({
      action: 'IMPORTED_REVIEW_SUBMITTED',
      userId: user.id,
      entityType: 'ImportedReview',
      entityId: imported.id,
      metadata: { source: sanitizedSource, rating: roundedRating },
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json(
      {
        id: imported.id,
        rating: Number(imported.rating),
        source: imported.source,
        verificationStatus: imported.verificationStatus,
        createdAt: imported.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    // H23: no more silent 500s on this family of routes.
    // eslint-disable-next-line no-console
    console.error('[ImportedReviews] Request failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function GET(_request: Request) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const reviews = await prisma.importedReview.findMany({
      where: { cleanerId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        text: r.text,
        source: r.source,
        reviewerName: r.reviewerName,
        hasEvidence: !!r.evidenceUrl,
        verificationStatus: r.verificationStatus,
        adminNotes: r.verificationStatus === 'REJECTED' ? r.adminNotes : null,
        createdAt: r.createdAt,
      })),
      maxAllowed: MAX_IMPORTED_REVIEWS,
      remaining: Math.max(
        0,
        MAX_IMPORTED_REVIEWS - reviews.filter((r) => r.verificationStatus !== 'REJECTED').length
      ),
    });
  } catch (error) {
    // H23: no more silent 500s on this family of routes.
    // eslint-disable-next-line no-console
    console.error('[ImportedReviews] Request failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
