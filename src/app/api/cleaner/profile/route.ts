import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { isProfileComplete } from '@/lib/cleaner/profile-completion';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { validatePriceFloors, validateServiceTypePricing } from '@/lib/services/pricing.service';
import { putObject, resolveProfileImageUrl } from '@/lib/storage/r2-client';
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

  // Onboarding gate = the canonical profile-complete definition + a set password.
  // The profile-details half is the single source of truth (isProfileComplete);
  // the password requirement is composed on top (a distinct onboarding concern).
  const onboardingComplete = isProfileComplete(profile) && !!profile.user.passwordHash;

  const imageUrl = await resolveProfileImageUrl(profile.user.image);

  return NextResponse.json({
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.user.phone,
    image: imageUrl,
    bio: profile.bio || '',
    hourlyRateRegular: profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null,
    hourlyRateDeep: profile.hourlyRateDeep ? Number(profile.hourlyRateDeep) : null,
    hourlyRateSameDay: profile.hourlyRateSameDay ? Number(profile.hourlyRateSameDay) : null,
    eotPrices: profile.eotPrices || null,
    airbnbPrices: profile.airbnbPrices || null,
    specialties: profile.specialties,
    languages: profile.languages || [],
    serviceTypes: profile.serviceTypes || [],
    hoursPerWeek: profile.hoursPerWeek,
    yearsExperience: profile.yearsExperience,
    tier: profile.tier,
    location: profile.location,
    postcode: profile.postcode,
    latitude: profile.latitude,
    longitude: profile.longitude,
    radius: profile.radius,
    travelMode: profile.travelMode,
    homePostcode: profile.homePostcode,
    maxTravelMinutes: profile.maxTravelMinutes,
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
    hourlyRateRegular,
    hourlyRateDeep,
    hourlyRateSameDay,
    eotPrices,
    airbnbPrices,
    specialties,
    languages,
    serviceTypes,
    hoursPerWeek,
    yearsExperience,
    radius,
    travelMode,
    image,
    postcode,
    password,
    testimonials,
    homePostcode,
    maxTravelMinutes,
  } = body;

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // Validate pricing
  const pricingData = {
    hourlyRateRegular:
      hourlyRateRegular !== undefined
        ? Number(hourlyRateRegular)
        : profile.hourlyRateRegular
          ? Number(profile.hourlyRateRegular)
          : null,
    hourlyRateDeep:
      hourlyRateDeep !== undefined
        ? Number(hourlyRateDeep)
        : profile.hourlyRateDeep
          ? Number(profile.hourlyRateDeep)
          : null,
    hourlyRateSameDay:
      hourlyRateSameDay !== undefined
        ? Number(hourlyRateSameDay)
        : profile.hourlyRateSameDay
          ? Number(profile.hourlyRateSameDay)
          : null,
    eotPrices:
      eotPrices !== undefined ? eotPrices : (profile.eotPrices as Record<string, number> | null),
    airbnbPrices:
      airbnbPrices !== undefined
        ? airbnbPrices
        : (profile.airbnbPrices as Record<string, number> | null),
  };

  const effectiveServiceTypes = serviceTypes !== undefined ? serviceTypes : profile.serviceTypes;

  const validatedServiceTypes = SAME_DAY_FEATURE_ENABLED
    ? effectiveServiceTypes
    : effectiveServiceTypes.filter((s: string) => s !== 'same_day');

  const stpCheck = validateServiceTypePricing(validatedServiceTypes, pricingData);
  if (!stpCheck.valid) {
    return NextResponse.json({ error: stpCheck.error }, { status: 400 });
  }

  const floorCheck = validatePriceFloors(pricingData, validatedServiceTypes);
  if (!floorCheck.valid) {
    return NextResponse.json({ error: floorCheck.error }, { status: 400 });
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
  if (hourlyRateRegular !== undefined)
    profileUpdate.hourlyRateRegular = hourlyRateRegular !== null ? Number(hourlyRateRegular) : null;
  if (hourlyRateDeep !== undefined)
    profileUpdate.hourlyRateDeep = hourlyRateDeep !== null ? Number(hourlyRateDeep) : null;
  if (hourlyRateSameDay !== undefined)
    profileUpdate.hourlyRateSameDay = hourlyRateSameDay !== null ? Number(hourlyRateSameDay) : null;
  if (eotPrices !== undefined) profileUpdate.eotPrices = eotPrices;
  if (airbnbPrices !== undefined) profileUpdate.airbnbPrices = airbnbPrices;
  if (specialties !== undefined) profileUpdate.specialties = specialties;
  if (languages !== undefined) profileUpdate.languages = languages;
  if (serviceTypes !== undefined) {
    profileUpdate.serviceTypes = SAME_DAY_FEATURE_ENABLED
      ? serviceTypes
      : serviceTypes.filter((s: string) => s !== 'same_day');
  }
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
  if (homePostcode !== undefined) {
    const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
    const trimmedPostcode = homePostcode.trim();
    if (!UK_POSTCODE_RE.test(trimmedPostcode)) {
      return NextResponse.json({ error: 'Please enter a valid UK postcode' }, { status: 400 });
    }
    profileUpdate.homePostcode = trimmedPostcode.toUpperCase();
    profileUpdate.postcode = trimmedPostcode.toUpperCase();
    profileUpdate.location = trimmedPostcode.toUpperCase();
    const geo = await lookupPostcode(trimmedPostcode);
    if (geo) {
      profileUpdate.homeLatitude = geo.latitude;
      profileUpdate.homeLongitude = geo.longitude;
      profileUpdate.homeGeocodedAt = new Date();
      profileUpdate.latitude = geo.latitude;
      profileUpdate.longitude = geo.longitude;
    }
  }
  if (maxTravelMinutes !== undefined) {
    const mtm = Number(maxTravelMinutes);
    if (isNaN(mtm) || mtm < 5 || mtm > 120) {
      return NextResponse.json(
        { error: 'Max travel time must be between 5 and 120 minutes' },
        { status: 400 }
      );
    }
    profileUpdate.maxTravelMinutes = mtm;
  }
  if (postcode !== undefined && homePostcode === undefined) {
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
    if (image !== undefined) {
      if (typeof image === 'string' && image.startsWith('data:image/')) {
        const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const objectKey = `profile-photos/${user.id}.${ext}`;
          await putObject(objectKey, buffer, `image/${match[1]}`);
          userUpdate.image = objectKey;
        }
      } else if (typeof image === 'string' && image.length > 0) {
        userUpdate.image = image;
      }
    }
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
