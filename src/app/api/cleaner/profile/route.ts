import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { lookupPostcode } from '@/lib/utils/postcode';

export async function GET() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          image: true,
          passwordHash: true,
          reviewsReceived: { select: { id: true } },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  const onboardingComplete =
    !!profile.bio &&
    !!profile.postcode &&
    profile.specialties.length > 0 &&
    !!profile.user.passwordHash;

  return NextResponse.json({
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    image: profile.user.image,
    bio: profile.bio || '',
    hourlyRate: Number(profile.hourlyRate),
    specialties: profile.specialties,
    languages: profile.languages || [],
    serviceTypes: profile.serviceTypes || [],
    serviceRates: profile.serviceRates || {},
    hoursPerWeek: profile.hoursPerWeek,
    yearsExperience: profile.yearsExperience,
    tier: profile.tier,
    location: profile.location,
    postcode: profile.postcode,
    latitude: profile.latitude,
    longitude: profile.longitude,
    radius: profile.radius,
    travelMode: profile.travelMode,
    verified: profile.verified,
    verificationStatus: profile.verificationStatus,
    rating: Number(profile.rating),
    completedJobs: profile.completedJobs,
    backgroundCheckPassed: profile.backgroundCheckPassed,
    dbsCertNumber: profile.dbsCertNumber,
    dbsCertVerified: profile.dbsCertVerified,
    dbsCertIssueDate: profile.dbsCertIssueDate,
    insuranceVerified: profile.insuranceVerified,
    insuranceExpiresAt: profile.insuranceExpiresAt,
    rightToWorkStatus: profile.rightToWorkStatus,
    rightToWorkDocType: profile.rightToWorkDocType,
    rightToWorkExpiresAt: profile.rightToWorkExpiresAt,
    identityVerifiedAt: profile.identityVerifiedAt,
    availableNow: profile.availableNow,
    reviewCount: profile.user.reviewsReceived.length,
    testimonials: profile.testimonials || [],
    onboardingComplete,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    bio,
    hourlyRate,
    specialties,
    languages,
    serviceTypes,
    serviceRates,
    hoursPerWeek,
    yearsExperience,
    radius,
    travelMode,
    image,
    postcode,
    password,
    testimonials,
  } = body;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Validate hourly rate
  if (hourlyRate !== undefined) {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 14 || rate > 100) {
      return NextResponse.json(
        { error: 'Hourly rate must be between £14 and £100' },
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

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
  }

  const profileUpdate: Record<string, unknown> = {};
  if (bio !== undefined) profileUpdate.bio = bio.trim();
  if (hourlyRate !== undefined) profileUpdate.hourlyRate = Number(hourlyRate);
  if (specialties !== undefined) profileUpdate.specialties = specialties;
  if (languages !== undefined) profileUpdate.languages = languages;
  if (serviceTypes !== undefined) profileUpdate.serviceTypes = serviceTypes;
  if (serviceRates !== undefined) profileUpdate.serviceRates = serviceRates;
  if (hoursPerWeek !== undefined)
    profileUpdate.hoursPerWeek = hoursPerWeek ? Number(hoursPerWeek) : null;
  if (yearsExperience !== undefined)
    profileUpdate.yearsExperience = yearsExperience ? Number(yearsExperience) : null;
  if (radius !== undefined) profileUpdate.radius = Number(radius);
  if (travelMode !== undefined) {
    const validModes = ['car', 'public_transport', 'bicycle', 'walking'];
    if (validModes.includes(travelMode)) {
      profileUpdate.travelMode = travelMode;
    }
  }
  if (postcode !== undefined) {
    profileUpdate.postcode = postcode.trim();
    profileUpdate.location = postcode.trim();
    const geo = await lookupPostcode(postcode.trim());
    if (geo) {
      profileUpdate.latitude = geo.latitude;
      profileUpdate.longitude = geo.longitude;
    }
  }
  if (testimonials !== undefined) {
    if (!Array.isArray(testimonials) || testimonials.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 testimonials allowed' }, { status: 400 });
    }
    profileUpdate.testimonials = testimonials;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(profileUpdate).length > 0) {
      await tx.cleanerProfile.update({
        where: { id: profile.id },
        data: profileUpdate,
      });
    }

    const userUpdate: Record<string, unknown> = {};
    if (image !== undefined) userUpdate.image = image;
    if (password !== undefined) userUpdate.passwordHash = await bcrypt.hash(password, 12);
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: userUpdate,
      });
    }
  });

  await AuditService.log({
    userId: user.id,
    action: 'CLEANER_PROFILE_UPDATED',
    entityType: 'CleanerProfile',
    entityId: profile.id,
    metadata: {
      updatedFields: [
        ...Object.keys(profileUpdate),
        ...(image !== undefined ? ['image'] : []),
        ...(password !== undefined ? ['password'] : []),
      ],
    },
  });

  return NextResponse.json({ success: true });
}
