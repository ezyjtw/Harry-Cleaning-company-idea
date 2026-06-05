import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { sendVerificationDecision } from '@/lib/services/email.service';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, reason } = body;

    if (action !== 'VERIFY' && action !== 'REJECT') {
      return NextResponse.json({ error: 'action must be "VERIFY" or "REJECT"' }, { status: 400 });
    }

    if (action === 'REJECT' && (!reason || typeof reason !== 'string' || !reason.trim())) {
      return NextResponse.json({ error: 'reason is required when rejecting' }, { status: 400 });
    }

    if (reason && reason.length > 500) {
      return NextResponse.json(
        { error: 'reason must be 500 characters or fewer' },
        { status: 400 }
      );
    }

    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner not found.' }, { status: 404 });
    }

    const isVerify = action === 'VERIFY';

    if (isVerify) {
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          verified: true,
          verificationStatus: 'VERIFIED',
          identityVerifiedAt: new Date(),
        },
      });
    } else {
      const existingMeta = (profile.verificationMeta as Record<string, unknown>) || {};
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          verified: false,
          verificationStatus: 'REJECTED',
          verificationMeta: {
            ...existingMeta,
            rejectionReason: reason.trim(),
            rejectedAt: new Date().toISOString(),
            rejectedBy: admin.id,
          },
        },
      });
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    await AuditService.log({
      userId: admin.id,
      action: isVerify ? 'CLEANER_VERIFIED' : 'CLEANER_REJECTED',
      entityType: 'CleanerProfile',
      entityId: profile.id,
      metadata: {
        cleanerUserId: profile.user.id,
        cleanerEmail: profile.user.email,
        ...(reason ? { reason: reason.trim() } : {}),
      },
      ipAddress,
    });

    sendVerificationDecision({
      cleanerName: profile.user.name || 'there',
      cleanerEmail: profile.user.email,
      approved: isVerify,
      reason: isVerify ? undefined : reason?.trim(),
    }).catch(() => {});

    const updated = await prisma.cleanerProfile.findUnique({
      where: { id: profile.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      },
    });

    return NextResponse.json({
      message: isVerify ? 'Cleaner verified successfully' : 'Cleaner rejected',
      cleaner: updated,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process verification.' }, { status: 500 });
  }
}
