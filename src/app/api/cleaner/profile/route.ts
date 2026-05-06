import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: { select: { name: true, email: true, phone: true, image: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    image: profile.user.image,
    bio: profile.bio || '',
    hourlyRate: Number(profile.hourlyRate),
    specialties: profile.specialties,
    tier: profile.tier,
    location: profile.location,
    postcode: profile.postcode,
    radius: profile.radius,
    verified: profile.verified,
    verificationStatus: profile.verificationStatus,
    rating: Number(profile.rating),
    completedJobs: profile.completedJobs,
    backgroundCheckPassed: profile.backgroundCheckPassed,
    dbsCertNumber: profile.dbsCertNumber,
    dbsCertVerified: profile.dbsCertVerified,
    dbsCertIssueDate: profile.dbsCertIssueDate,
    rightToWorkStatus: profile.rightToWorkStatus,
    rightToWorkDocType: profile.rightToWorkDocType,
    rightToWorkExpiresAt: profile.rightToWorkExpiresAt,
    identityVerifiedAt: profile.identityVerifiedAt,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { bio, hourlyRate, specialties, radius, image } = body;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Validate hourly rate
  if (hourlyRate !== undefined) {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 14 || rate > 35) {
      return NextResponse.json(
        { error: 'Hourly rate must be between £14 and £35' },
        { status: 400 }
      );
    }
  }

  // Validate radius
  if (radius !== undefined) {
    const r = Number(radius);
    if (isNaN(r) || r < 1 || r > 50) {
      return NextResponse.json(
        { error: 'Travel radius must be between 1 and 50 miles' },
        { status: 400 }
      );
    }
  }

  // Validate bio length
  if (bio !== undefined && typeof bio === 'string' && bio.length > 500) {
    return NextResponse.json({ error: 'Bio must be 500 characters or fewer' }, { status: 400 });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (bio !== undefined) profileUpdate.bio = bio.trim();
  if (hourlyRate !== undefined) profileUpdate.hourlyRate = Number(hourlyRate);
  if (specialties !== undefined) profileUpdate.specialties = specialties;
  if (radius !== undefined) profileUpdate.radius = Number(radius);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(profileUpdate).length > 0) {
      await tx.cleanerProfile.update({
        where: { id: profile.id },
        data: profileUpdate,
      });
    }

    if (image !== undefined) {
      await tx.user.update({
        where: { id: user.id },
        data: { image },
      });
    }
  });

  await AuditService.log({
    userId: user.id,
    action: 'CLEANER_PROFILE_UPDATED',
    entityType: 'CleanerProfile',
    entityId: profile.id,
    metadata: {
      updatedFields: [...Object.keys(profileUpdate), ...(image !== undefined ? ['image'] : [])],
    },
  });

  return NextResponse.json({ success: true });
}
