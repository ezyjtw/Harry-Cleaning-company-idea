// Admin verification restructure (James, from live testing): the queue's unit
// is the CLEANER, not the document. One GET returns every cleaner awaiting
// verification action, with their document states rolled up so the page can
// chip "outstanding vs submitted" at a glance. Presentation-layer aggregation
// over the existing machinery — per-document verify and the overall
// verify/activate routes are unchanged. (DocumentUpload has no Prisma relation
// to CleanerProfile — profileId is a scalar — so the join happens here in JS.)
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// The onboarding upload set. photo_id + right_to_work + insurance are required
// for activation; DBS is optional (shown when present).
const REQUIRED_DOC_TYPES = ['photo_id', 'right_to_work', 'insurance'] as const;

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  // Base set: cleaners not yet verified/activated. Cleaners who ARE verified
  // but have documents awaiting review (e.g. an insurance renewal) are added
  // from the pending-documents side below.
  const [unverifiedProfiles, pendingDocs] = await Promise.all([
    prisma.cleanerProfile.findMany({
      where: {
        user: { isDeleted: false },
        OR: [{ verified: false }, { verificationStatus: { in: ['PENDING', 'UNVERIFIED'] } }],
      },
      select: {
        id: true,
        createdAt: true,
        verified: true,
        verificationStatus: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.documentUpload.findMany({
      where: { isVerified: false, isDestroyed: false, profileId: { not: null } },
      select: { profileId: true },
      distinct: ['profileId'],
    }),
  ]);

  // Verified cleaners with pending docs → fetch their profiles too.
  const knownIds = new Set(unverifiedProfiles.map((p) => p.id));
  const extraIds = pendingDocs
    .map((d) => d.profileId as string)
    .filter((id) => !knownIds.has(id));
  const extraProfiles = extraIds.length
    ? await prisma.cleanerProfile.findMany({
        where: { id: { in: extraIds }, user: { isDeleted: false } },
        select: {
          id: true,
          createdAt: true,
          verified: true,
          verificationStatus: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  const profiles = [...unverifiedProfiles, ...extraProfiles];
  const docs = profiles.length
    ? await prisma.documentUpload.findMany({
        where: { profileId: { in: profiles.map((p) => p.id) }, isDestroyed: false },
        select: {
          id: true,
          profileId: true,
          documentType: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          isVerified: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const cleaners = profiles
    .map((p) => {
      const mine = docs.filter((d) => d.profileId === p.id);
      const byType: Record<string, { submitted: boolean; verified: boolean }> = {};
      for (const d of mine) {
        const cur = byType[d.documentType] ?? { submitted: false, verified: false };
        cur.submitted = true;
        cur.verified = cur.verified || d.isVerified;
        byType[d.documentType] = cur;
      }
      const missing = REQUIRED_DOC_TYPES.filter((t) => !byType[t]?.submitted);
      return {
        profileId: p.id,
        userId: p.user.id,
        name: p.user.name || 'Cleaner',
        email: p.user.email,
        appliedAt: p.createdAt.toISOString(),
        verified: p.verified,
        verificationStatus: p.verificationStatus,
        documents: mine,
        docStates: byType,
        missing,
        pendingReview: mine.filter((d) => !d.isVerified).length,
        // Ready for review = everything required is submitted.
        readyForReview: missing.length === 0,
      };
    })
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  return NextResponse.json({ cleaners, count: cleaners.length });
}
