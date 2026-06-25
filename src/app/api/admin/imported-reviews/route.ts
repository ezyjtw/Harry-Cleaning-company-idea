import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const pending = await prisma.importedReview.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        cleaner: {
          select: {
            id: true,
            name: true,
            email: true,
            cleanerProfile: { select: { id: true, verified: true } },
          },
        },
      },
    });

    return NextResponse.json({
      reviews: pending.map((r) => ({
        id: r.id,
        cleanerId: r.cleanerId,
        cleanerName: r.cleaner.name,
        cleanerEmail: r.cleaner.email,
        cleanerVerified: r.cleaner.cleanerProfile?.verified ?? false,
        rating: Number(r.rating),
        text: r.text,
        source: r.source,
        reviewerName: r.reviewerName,
        referenceContacts: r.referenceContacts,
        hasEvidence: !!r.evidenceUrl,
        evidenceUrl: r.evidenceUrl,
        createdAt: r.createdAt,
      })),
      count: pending.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
