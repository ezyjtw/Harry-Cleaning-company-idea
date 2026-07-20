import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { sanitizeInput } from '@/lib/utils/validation';

// H24 (James-ruled, the verification-queue playbook): the unit is the CLEANER.
// The list is every cleaner with reviews needing admin action — a PENDING
// imported review or a FLAGGED native review — newest action first. Each row
// carries the cleaner's FULL review dossier (native + imported, all states),
// so the page opens straight into everything the admin can act on.
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const [pendingImports, flaggedNatives, uncheckedNatives] = await Promise.all([
      prisma.importedReview.findMany({
        where: { verificationStatus: 'PENDING' },
        select: { cleanerId: true, createdAt: true },
      }),
      prisma.review.findMany({
        where: { visibility: 'FLAGGED' },
        select: { cleanerId: true, createdAt: true },
      }),
      // H72: a freshly submitted review (VISIBLE, never moderated) had NO admin
      // door anywhere — this queue only triggered on pending imports and flags,
      // so a new customer review was invisible to admins until someone flagged
      // it from a surface that doesn't exist. Never-checked native reviews are
      // now a third action trigger; "Looks fine" (action VISIBLE) clears them.
      prisma.review.findMany({
        where: { isModerated: false },
        select: { cleanerId: true, createdAt: true },
      }),
    ]);

    // Cleaner unit: union of the action queues, newest actionable item first.
    const newestActionAt = new Map<string, Date>();
    for (const row of [...pendingImports, ...flaggedNatives, ...uncheckedNatives]) {
      const prev = newestActionAt.get(row.cleanerId);
      if (!prev || row.createdAt > prev) newestActionAt.set(row.cleanerId, row.createdAt);
    }
    const cleanerIds = Array.from(newestActionAt.keys()).sort(
      (a, b) =>
        (newestActionAt.get(b) as Date).getTime() - (newestActionAt.get(a) as Date).getTime()
    );

    if (cleanerIds.length === 0) {
      return NextResponse.json({ cleaners: [], count: 0 });
    }

    const [users, imported, native] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: cleanerIds } },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          cleanerProfile: { select: { verified: true, rating: true } },
        },
      }),
      prisma.importedReview.findMany({
        where: { cleanerId: { in: cleanerIds } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { cleanerId: { in: cleanerIds } },
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true } } },
      }),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const importedByCleaner = new Map<string, typeof imported>();
    for (const r of imported) {
      const list = importedByCleaner.get(r.cleanerId) ?? [];
      list.push(r);
      importedByCleaner.set(r.cleanerId, list);
    }
    const nativeByCleaner = new Map<string, typeof native>();
    for (const r of native) {
      const list = nativeByCleaner.get(r.cleanerId) ?? [];
      list.push(r);
      nativeByCleaner.set(r.cleanerId, list);
    }

    const cleaners = await Promise.all(
      cleanerIds.map(async (id) => {
        const u = userById.get(id);
        const imports = importedByCleaner.get(id) ?? [];
        const natives = nativeByCleaner.get(id) ?? [];
        return {
          cleanerId: id,
          name: u?.name ?? 'Cleaner',
          email: u?.email ?? null,
          photo: await resolveProfileImageUrl(u?.image ?? null),
          verified: u?.cleanerProfile?.verified ?? false,
          rating: u?.cleanerProfile ? Number(u.cleanerProfile.rating) : 0,
          pendingImportedCount: imports.filter((r) => r.verificationStatus === 'PENDING').length,
          flaggedNativeCount: natives.filter((r) => r.visibility === 'FLAGGED').length,
          uncheckedNativeCount: natives.filter((r) => !r.isModerated).length,
          newestActionAt: newestActionAt.get(id),
          importedReviews: imports.map((r) => ({
            id: r.id,
            rating: Number(r.rating),
            text: r.text,
            source: r.source,
            reviewerName: r.reviewerName,
            referenceContacts: r.referenceContacts,
            hasEvidence: !!r.evidenceUrl,
            verificationStatus: r.verificationStatus,
            adminNotes: r.adminNotes,
            createdAt: r.createdAt,
          })),
          nativeReviews: natives.map((r) => ({
            id: r.id,
            rating: Number(r.rating),
            text: r.text,
            clientName: r.client?.name ?? 'Customer',
            visibility: r.visibility,
            isModerated: r.isModerated,
            createdAt: r.createdAt,
          })),
        };
      })
    );

    return NextResponse.json({ cleaners, count: cleaners.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminImportedReviews] List failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// P7 (ledger, the onboarding-help ruling): the admin can add an imported
// review on a cleaner's behalf from the cleaner dossier. CAP-EXEMPT for admin
// (the cleaner-side 3-review cap is an anti-gaming limit on self-service);
// enters the SAME verification flow — created PENDING, verified/rejected with
// the existing queue machinery, so nothing counts toward a rating unchecked.
export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null);
    const cleanerId = typeof body?.cleanerId === 'string' ? body.cleanerId : '';
    const { rating, text, source, reviewerName, referenceContacts } = body ?? {};

    if (!cleanerId) {
      return NextResponse.json({ error: 'cleanerId is required.' }, { status: 400 });
    }
    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      return NextResponse.json({ error: 'A source platform is required.' }, { status: 400 });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a number between 1 and 5.' },
        { status: 400 }
      );
    }

    const cleaner = await prisma.user.findFirst({
      where: { id: cleanerId, role: 'CLEANER' },
      select: { id: true },
    });
    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
    }

    const imported = await prisma.importedReview.create({
      data: {
        cleanerId,
        rating: Math.round(rating * 10) / 10,
        text: text ? sanitizeInput(String(text)).substring(0, 2000) : null,
        source: sanitizeInput(String(source).trim()).substring(0, 200),
        reviewerName: reviewerName
          ? sanitizeInput(String(reviewerName).trim()).substring(0, 200)
          : null,
        referenceContacts: referenceContacts
          ? sanitizeInput(String(referenceContacts).trim()).substring(0, 1000)
          : null,
        verificationStatus: 'PENDING',
      },
    });

    await AuditService.log({
      action: 'IMPORTED_REVIEW_SUBMITTED',
      userId: admin.id,
      entityType: 'ImportedReview',
      entityId: imported.id,
      metadata: {
        cleanerId,
        source: imported.source,
        rating: Number(imported.rating),
        byAdmin: true,
      },
    }).catch(() => {});

    return NextResponse.json(
      { id: imported.id, verificationStatus: imported.verificationStatus },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminImportedReviews] Create failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
