import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { isProfileComplete } from '@/lib/cleaner/profile-completion';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { triggerCatchmentRefresh } from '@/lib/services/catchment-generation.service';
import { validatePriceFloors, validateServiceTypePricing } from '@/lib/services/pricing.service';
import { putObject, resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { decodeBase64File, IMAGE_MIMES } from '@/lib/utils/file-validation';
import { displayName } from '@/lib/utils/name';
import { lookupPostcodeOutcome } from '@/lib/utils/postcode';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

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
    // F5: display-normalised like every other cleaner-facing serializer, so
    // pre-heal lowercase rows still render properly cased in the portal shell.
    name: displayName(profile.user.name),
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
    // F6: complete postcode only, stored in canonical form.
    const norm = normalizeUkPostcode(String(homePostcode));
    if (!norm) {
      return NextResponse.json(
        { error: 'Enter your full UK postcode (e.g. E4 7AP)' },
        { status: 400 }
      );
    }
    // F6 strong version: a postcode that doesn't geocode is rejected at save —
    // previously it was stored silently (with stale coordinates) and polygon
    // generation failed later. Fail-open only on a postcodes.io outage: the
    // save proceeds ungeocoded and homeGeocodedAt null flags the lazy retry
    // (the catchment generator re-looks the postcode up on its next refresh).
    const lookup = await lookupPostcodeOutcome(norm);
    if (lookup.status === 'not_found') {
      return NextResponse.json(
        { error: "We can't find that postcode — check and try again." },
        { status: 400 }
      );
    }
    profileUpdate.homePostcode = norm;
    profileUpdate.postcode = norm;
    profileUpdate.location = norm;
    if (lookup.status === 'found') {
      profileUpdate.homeLatitude = lookup.result.latitude;
      profileUpdate.homeLongitude = lookup.result.longitude;
      profileUpdate.homeGeocodedAt = new Date();
      profileUpdate.latitude = lookup.result.latitude;
      profileUpdate.longitude = lookup.result.longitude;
    } else {
      profileUpdate.homeGeocodedAt = null;
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
    // F6: same complete-form + save-time verification as the homePostcode
    // branch (was: format check + silent-null geocode).
    const norm = normalizeUkPostcode(String(postcode));
    if (!norm) {
      return NextResponse.json(
        { error: 'Enter your full UK postcode (e.g. E4 7AP)' },
        { status: 400 }
      );
    }
    const lookup = await lookupPostcodeOutcome(norm);
    if (lookup.status === 'not_found') {
      return NextResponse.json(
        { error: "We can't find that postcode — check and try again." },
        { status: 400 }
      );
    }
    profileUpdate.postcode = norm;
    profileUpdate.location = norm;
    if (lookup.status === 'found') {
      profileUpdate.latitude = lookup.result.latitude;
      profileUpdate.longitude = lookup.result.longitude;
    }
  }
  if (testimonials !== undefined) {
    if (!Array.isArray(testimonials) || testimonials.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 testimonials allowed' }, { status: 400 });
    }
    profileUpdate.testimonials = testimonials;
  }

  // Validate + upload a new profile photo (data URL) BEFORE the transaction, so
  // an invalid file returns 400 from the handler and the R2 write stays out of
  // the DB transaction. Content-verify (JPEG/PNG/WebP) and cap at 5 MB.
  let imageObjectKey: string | null = null;
  if (typeof image === 'string' && image.startsWith('data:image/')) {
    const check = decodeBase64File(image, {
      allowed: IMAGE_MIMES,
      maxSize: 5 * 1024 * 1024,
      typeLabel: 'a JPG or PNG photo',
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const ext = check.mime === 'image/jpeg' ? 'jpg' : check.mime.split('/')[1];
    imageObjectKey = `profile-photos/${user.id}.${ext}`;
    await putObject(imageObjectKey, check.buffer, check.mime);
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
      if (imageObjectKey) {
        userUpdate.image = imageObjectKey;
      } else if (typeof image === 'string' && image.length > 0 && !image.startsWith('data:')) {
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

  // B: home point or travel time changed → refresh the stored isochrone.
  // Fire-and-forget (dormant without ORS_API_KEY); never blocks the save.
  if (profileUpdate.homePostcode !== undefined || profileUpdate.maxTravelMinutes !== undefined) {
    triggerCatchmentRefresh(user.id);
  }

  return NextResponse.json({ success: true });
}
