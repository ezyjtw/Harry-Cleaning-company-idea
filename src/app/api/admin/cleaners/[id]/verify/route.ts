import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { sendVerificationDecision } from '@/lib/services/email.service';
import { maybeMarkLive } from '@/lib/services/go-live.service';

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
      // Coverage precondition: verification is what makes a cleaner live/bookable, so
      // refuse to activate a cleaner with no usable service area — they'd be verified
      // and payment-ready yet matchable to no customer. Require geocoded coordinates
      // (legacy latitude/longitude OR homeLatitude/homeLongitude) AND a travel radius.
      const hasGeo =
        (profile.latitude !== null && profile.longitude !== null) ||
        (profile.homeLatitude !== null && profile.homeLongitude !== null);
      if (!hasGeo || profile.maxTravelMinutes === null) {
        return NextResponse.json(
          {
            error:
              'Cannot verify: this cleaner has no usable service area. They must set a valid home postcode (that geocodes) and a maximum travel time before they can go live.',
          },
          { status: 400 }
        );
      }

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

    // Two-stage flow: if insurance + Stripe were already green, this verify
    // completes go-live — fire the exactly-once live email.
    if (isVerify) void maybeMarkLive(profile.user.id);

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
