import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { updateStoredRating } from '@/lib/services/rating.service';
import { sanitizeInput } from '@/lib/utils/validation';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rl = checkRateLimit(`admin-imported-review-verify:${admin.id}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many verification actions. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { action, adminNotes } = body;

    if (action !== 'VERIFY' && action !== 'REJECT') {
      return NextResponse.json({ error: 'action must be "VERIFY" or "REJECT".' }, { status: 400 });
    }

    if (
      action === 'REJECT' &&
      (!adminNotes || typeof adminNotes !== 'string' || !adminNotes.trim())
    ) {
      return NextResponse.json(
        { error: 'adminNotes is required when rejecting.' },
        { status: 400 }
      );
    }

    if (adminNotes && typeof adminNotes === 'string' && adminNotes.length > 1000) {
      return NextResponse.json(
        { error: 'adminNotes must be 1000 characters or fewer.' },
        { status: 400 }
      );
    }

    const review = await prisma.importedReview.findUnique({
      where: { id: params.id },
    });

    if (!review) {
      return NextResponse.json({ error: 'Imported review not found.' }, { status: 404 });
    }

    if (review.verificationStatus !== 'PENDING') {
      return NextResponse.json(
        { error: `Review has already been ${review.verificationStatus.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const isVerify = action === 'VERIFY';
    const sanitizedNotes = adminNotes
      ? sanitizeInput(String(adminNotes).trim()).substring(0, 1000)
      : null;

    const updated = await prisma.importedReview.update({
      where: { id: params.id },
      data: {
        verificationStatus: isVerify ? 'VERIFIED' : 'REJECTED',
        adminNotes: sanitizedNotes,
        verifiedAt: new Date(),
        verifiedBy: admin.id,
      },
    });

    // Recompute stored rating: verify → imported review now counts in overall;
    // reject → excluded (was PENDING, already excluded, but recompute for consistency).
    await updateStoredRating(review.cleanerId);

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    await AuditService.log({
      userId: admin.id,
      action: isVerify ? 'IMPORTED_REVIEW_VERIFIED' : 'IMPORTED_REVIEW_REJECTED',
      entityType: 'ImportedReview',
      entityId: params.id,
      metadata: {
        cleanerId: review.cleanerId,
        rating: Number(review.rating),
        source: review.source,
        ...(sanitizedNotes ? { adminNotes: sanitizedNotes } : {}),
      },
      ipAddress,
    });

    return NextResponse.json({
      id: updated.id,
      verificationStatus: updated.verificationStatus,
      verifiedAt: updated.verifiedAt,
      message: isVerify
        ? 'Imported review verified — now counts toward cleaner rating.'
        : 'Imported review rejected.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
