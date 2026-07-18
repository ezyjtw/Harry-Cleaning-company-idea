import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isNewToRena } from '@/lib/constants/badges';
import prisma from '@/lib/db/prisma';
import { CURRENT_AGREEMENT_VERSION } from '@/lib/legal/self-employment-acknowledgment';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { currentAgreementHash } from '@/lib/services/agreement.service';
import { eligibleCleanerWhere, expandSlots } from '@/lib/services/area-search.service';
import { AuditService } from '@/lib/services/audit.service';
import { cleanerCoversPoint } from '@/lib/services/coverage.service';
import { DocumentStorageService } from '@/lib/services/document-storage.service';
import { sendSignupNotification } from '@/lib/services/email.service';
import { validatePriceFloors, validateServiceTypePricing } from '@/lib/services/pricing.service';
import { putObject, resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { decodeBase64File, IMAGE_MIMES } from '@/lib/utils/file-validation';
import { displayName } from '@/lib/utils/name';
import { haversineDistance, lookupPostcode, lookupPostcodeOutcome } from '@/lib/utils/postcode';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const availableNow = searchParams.get('available_now');
  const postcode = searchParams.get('postcode');
  const specialty = searchParams.get('specialty');
  const service = searchParams.get('service');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const now = new Date();
  // A2: the base eligibility filter is shared with the location pages
  // (area-search.service) so "who is bookable" can never fork between them.
  const where: Record<string, unknown> = eligibleCleanerWhere(now);

  if (availableNow === 'true') {
    where.availableNow = true;
  }

  if (specialty) {
    where.specialties = { has: specialty };
  }

  if (service) {
    const serviceTypeMap: Record<string, string> = {
      regular: 'regular',
      deep: 'deep',
      same_day: 'same_day',
      'same-day': 'same_day',
      end_of_tenancy: 'end_of_tenancy',
      eot: 'end_of_tenancy',
      airbnb: 'airbnb',
    };
    const mappedService = serviceTypeMap[service] || service;
    where.serviceTypes = { has: mappedService };

    const rateFilter: Record<string, Record<string, unknown>> = {
      regular: { hourlyRateRegular: { not: null } },
      deep: { hourlyRateDeep: { not: null } },
      same_day: { hourlyRateSameDay: { not: null } },
      end_of_tenancy: { eotPrices: { not: null } },
      airbnb: { airbnbPrices: { not: null } },
    };
    if (rateFilter[mappedService]) {
      Object.assign(where, rateFilter[mappedService]);
    }
  }

  let customerGeo: { latitude: number; longitude: number } | null = null;

  if (postcode) {
    const geo = await lookupPostcode(postcode);
    if (geo) {
      customerGeo = { latitude: geo.latitude, longitude: geo.longitude };
      where.latitude = { not: null };
      where.longitude = { not: null };
    } else {
      const prefix = postcode.split(' ')[0].toUpperCase();
      where.postcode = { startsWith: prefix };
    }
  }

  let cleaners = await prisma.cleanerProfile.findMany({
    where,
    // Coverage needs the stored isochrone ONLY when filtering by a customer
    // point; without a postcode (homepage carousel, plain directory) the
    // global omit keeps the heavy polygons out of the query entirely.
    ...(customerGeo ? { omit: { catchmentPolygon: false } } : {}),
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      availabilitySlots: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
  });

  // B: coverage filter runs on the RAW rows (polygon-first predicate; the
  // stored isochrone never enters the JSON response). Sorting by distance
  // still happens after mapping.
  if (customerGeo) {
    const geo = customerGeo;
    cleaners = cleaners.filter((c) => {
      if (c.latitude === null || c.longitude === null) return false;
      const d = haversineDistance(geo.latitude, geo.longitude, c.latitude, c.longitude);
      return cleanerCoversPoint(c, geo.latitude, geo.longitude, d);
    });
  }

  // H23: card review counts come from the SAME population as the blended
  // rating (native VISIBLE + imported VERIFIED) — reviewsReceived.length was
  // native-only AND counted hidden reviews, so imported-only founding
  // cleaners showed a real rating with "(0 reviews)".
  const { getReviewCounts } = await import('@/lib/services/rating.service');
  const reviewCounts = await getReviewCounts(cleaners.map((c) => c.user.id));

  const results = await Promise.all(
    cleaners.map(async (c) => {
      let distance: number | null = null;
      if (customerGeo && c.latitude !== null && c.longitude !== null) {
        distance = haversineDistance(
          customerGeo.latitude,
          customerGeo.longitude,
          c.latitude,
          c.longitude
        );
      }

      const photoUrl = await resolveProfileImageUrl(c.user.image);

      return {
        id: c.user.id,
        name: displayName(c.user.name),
        photo: photoUrl || '',
        image: photoUrl,
        rating: Number(c.rating),
        reviewCount: reviewCounts.get(c.user.id) ?? 0,
        completedJobs: c.completedJobs,
        yearsExperience: c.yearsExperience ?? 0,
        languages: c.languages || [],
        hourlyRateRegular: c.hourlyRateRegular ? Number(c.hourlyRateRegular) : null,
        hourlyRateDeep: c.hourlyRateDeep ? Number(c.hourlyRateDeep) : null,
        hourlyRateSameDay: c.hourlyRateSameDay ? Number(c.hourlyRateSameDay) : null,
        eotPrices: c.eotPrices || null,
        airbnbPrices: c.airbnbPrices || null,
        serviceTypes: c.serviceTypes || [],
        bio: c.bio,
        specialties: c.specialties,
        location: c.location || '',
        postcode: c.postcode,
        availableNow: c.availableNow,
        tier: c.tier.toLowerCase(),
        verified: c.verified,
        identityVerified: c.verificationStatus === 'VERIFIED',
        insured: c.insuranceVerified && (!c.insuranceExpiresAt || c.insuranceExpiresAt > now),
        backgroundChecked: c.backgroundCheckPassed,
        radius: c.radius,
        maxTravelMinutes: c.maxTravelMinutes,
        travelMode: c.travelMode,
        // F-B badges: permanent founding flag + computed "New to Rena" expiry
        // (5 completed jobs or 60 days post-go-live, whichever first).
        founding: c.foundingCleaner,
        isNew: isNewToRena(
          c.completedJobs,
          c.liveNotifiedAt ?? c.identityVerifiedAt ?? c.createdAt
        ),
        distance,
        ...expandSlots(c.availabilitySlots),
      };
    })
  );

  if (customerGeo) {
    // Coverage already decided on the raw rows above — just order by distance.
    results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  const total = results.length;
  const paged = results.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    cleaners: paged,
    count: total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}

// Stores an already-validated profile photo (content-verified + size-checked by
// decodeBase64File up-front in the POST handler). Returns the R2 object key.
async function uploadProfilePhoto(userId: string, buffer: Buffer, mime: string): Promise<string> {
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  const objectKey = `profile-photos/${userId}.${ext}`;
  await putObject(objectKey, buffer, mime);
  return objectKey;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`cleaner-signup:${ip}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();

    // Validate required fields
    const required = ['name', 'email', 'phone', 'postcode'];
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Validate the profile photo up-front (before any DB writes) so an invalid
    // file returns a human 400 to the wizard instead of being silently dropped.
    let photoUpload: { buffer: Buffer; mime: string } | null = null;
    if (body.profilePhoto && typeof body.profilePhoto === 'string') {
      const check = decodeBase64File(body.profilePhoto, {
        allowed: IMAGE_MIMES,
        maxSize: 5 * 1024 * 1024,
        typeLabel: 'a JPG or PNG photo',
      });
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      photoUpload = { buffer: check.buffer, mime: check.mime };
    }

    // Coverage is mandatory: without a travel radius a cleaner can't be matched to
    // any customer, so a valid maxTravelMinutes (5-120, matching the join wizard) is
    // required to create the profile — no coverage-less cleaners.
    const maxTravelMinutes = Number(body.maxTravelMinutes);
    if (
      !body.maxTravelMinutes ||
      Number.isNaN(maxTravelMinutes) ||
      maxTravelMinutes < 5 ||
      maxTravelMinutes > 120
    ) {
      return NextResponse.json(
        { error: 'maxTravelMinutes is required and must be between 5 and 120' },
        { status: 400 }
      );
    }

    // A14 gate: the self-employment acknowledgment must be confirmed to apply.
    if (body.acknowledgeSelfEmployment !== true) {
      return NextResponse.json(
        { error: 'You must acknowledge the self-employment terms to apply.' },
        { status: 400 }
      );
    }

    if (body.yearsExperience !== undefined && Number(body.yearsExperience) > 50) {
      return NextResponse.json({ error: 'Years of experience cannot exceed 50' }, { status: 400 });
    }

    // Parse per-service pricing fields
    const pricingData = {
      hourlyRateRegular: body.hourlyRateRegular ? Number(body.hourlyRateRegular) : null,
      hourlyRateDeep: body.hourlyRateDeep ? Number(body.hourlyRateDeep) : null,
      hourlyRateSameDay: body.hourlyRateSameDay ? Number(body.hourlyRateSameDay) : null,
      eotPrices: body.eotPrices || null,
      airbnbPrices: body.airbnbPrices || null,
    };

    const effectiveServiceTypes = body.serviceTypes || [];

    if (effectiveServiceTypes.length > 0) {
      const stpCheck = validateServiceTypePricing(effectiveServiceTypes, pricingData);
      if (!stpCheck.valid) {
        return NextResponse.json({ error: stpCheck.error }, { status: 400 });
      }

      const floorCheck = validatePriceFloors(pricingData);
      if (!floorCheck.valid) {
        return NextResponse.json({ error: floorCheck.error }, { status: 400 });
      }
    }

    // F6: the home postcode must be a COMPLETE postcode in canonical form —
    // a polygon can't anchor on half a postcode, and the normalised form is
    // what's stored, displayed, and fed to the catchment generator.
    const homePostcodeNorm = normalizeUkPostcode(String(body.postcode));
    if (!homePostcodeNorm) {
      return NextResponse.json(
        {
          error:
            'Enter your full postcode (e.g. E4 7AP) — we need it to match you with nearby customers.',
        },
        { status: 400 }
      );
    }

    // F6 strong version: verified against postcodes.io at save time. A postcode
    // that doesn't exist is rejected here, not stored to silently fail polygon
    // generation later. Fail-open ONLY on a provider outage: the save proceeds
    // ungeocoded (homeGeocodedAt stays null — the lazy-retry flag) and the
    // catchment generator re-looks it up on its next refresh.
    const lookup = await lookupPostcodeOutcome(homePostcodeNorm);
    if (lookup.status === 'not_found') {
      return NextResponse.json(
        { error: "We can't find that postcode — check and try again." },
        { status: 400 }
      );
    }
    const geo = lookup.status === 'found' ? lookup.result : null;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
      include: { cleanerProfile: { select: { id: true } } },
    });

    if (existing) {
      // Already a cleaner — block duplicate
      if (existing.cleanerProfile || existing.role === 'CLEANER') {
        return NextResponse.json(
          { error: 'A cleaner account with this email already exists. Please log in instead.' },
          { status: 409 }
        );
      }

      // Existing client — upgrade to cleaner
      let upgradePhotoKey: string | null = null;
      if (photoUpload) {
        upgradePhotoKey = await uploadProfilePhoto(
          existing.id,
          photoUpload.buffer,
          photoUpload.mime
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            role: 'CLEANER',
            phone: body.phone?.trim() || existing.phone,
            passwordHash: body.password
              ? await bcrypt.hash(body.password, 12)
              : existing.passwordHash,
            image: upgradePhotoKey || existing.image,
          },
        });

        const profile = await tx.cleanerProfile.create({
          data: {
            userId: user.id,
            bio: body.bio?.trim() || null,
            hourlyRateRegular: pricingData.hourlyRateRegular,
            hourlyRateDeep: pricingData.hourlyRateDeep,
            hourlyRateSameDay: pricingData.hourlyRateSameDay,
            eotPrices: pricingData.eotPrices || undefined,
            airbnbPrices: pricingData.airbnbPrices || undefined,
            specialties: body.specialties || [],
            languages: body.languages || [],
            serviceTypes: body.serviceTypes || [],
            hoursPerWeek: body.hoursPerWeek ? Number(body.hoursPerWeek) : null,
            yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : null,
            location: homePostcodeNorm,
            postcode: homePostcodeNorm,
            latitude: geo?.latitude ?? null,
            longitude: geo?.longitude ?? null,
            homePostcode: homePostcodeNorm,
            homeLatitude: geo?.latitude ?? null,
            homeLongitude: geo?.longitude ?? null,
            homeGeocodedAt: geo ? new Date() : null,
            maxTravelMinutes,
            radius: 10,
            travelMode: body.travelMode || 'public_transport',
            verificationStatus: 'PENDING',
            acknowledgmentVersion: CURRENT_AGREEMENT_VERSION,
            rightToWorkDocType: body.rightToWorkDocType || null,
            rightToWorkShareCode: body.rightToWorkShareCode || null,
            rightToWorkExpiresAt: body.rightToWorkExpiryDate
              ? new Date(body.rightToWorkExpiryDate)
              : null,
            dbsCertNumber: body.dbsCertNumber?.trim() || null,
            dbsCertIssueDate: body.dbsCertIssueDate ? new Date(body.dbsCertIssueDate) : null,
            rightToWorkStatus: body.rightToWorkDocType ? 'PENDING' : 'UNVERIFIED',
            verificationMeta: body.selfiePhoto
              ? { livenessComplete: true, dbsOption: body.dbsOption || null }
              : body.dbsOption
                ? { dbsOption: body.dbsOption }
                : undefined,
          },
        });

        // A14: append-only acknowledgment evidence (version + hash + IP + time).
        await tx.agreementAcceptance.create({
          data: {
            cleanerId: user.id,
            agreementVersion: CURRENT_AGREEMENT_VERSION,
            textHash: currentAgreementHash(),
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') || undefined,
          },
        });

        return { user, profile };
      });

      await AuditService.log({
        userId: result.user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: result.user.id,
        metadata: { role: 'CLEANER', email: body.email, upgradedFromClient: true },
      });

      await AuditService.log({
        userId: result.user.id,
        action: 'CLEANER_PROFILE_UPDATED',
        entityType: 'CleanerProfile',
        entityId: result.profile.id,
        metadata: {
          event: 'onboarding_submitted',
          dbsOption: body.dbsOption || null,
          hasRtwDoc: !!body.rightToWorkDocType,
          hasSelfie: !!body.selfiePhoto,
        },
      });

      if (
        body.selfiePhoto &&
        typeof body.selfiePhoto === 'string' &&
        body.selfiePhoto.startsWith('data:image/')
      ) {
        // F13: header-only regex — /(.+)$/ over a multi-MB selfie base64 string
        // overflows the regex stack (RangeError) and 500s the whole signup.
        const selfieComma = body.selfiePhoto.indexOf(',');
        const selfieHeader = selfieComma > 0 ? body.selfiePhoto.slice(0, selfieComma) : '';
        const match = selfieHeader.match(/^data:image\/(\w+);base64$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(body.selfiePhoto.slice(selfieComma + 1), 'base64');
          await DocumentStorageService.uploadDocument({
            userId: result.user.id,
            profileId: result.profile.id,
            documentType: 'selfie',
            fileBuffer: buffer,
            originalName: `selfie.${ext}`,
            mimeType: `image/${match[1]}`,
          }).catch(() => {});
        }
      }

      sendSignupNotification({
        name: result.user.name || body.name,
        email: result.user.email,
        phone: body.phone?.trim() || '',
        role: 'CLEANER',
        createdAt: result.user.createdAt.toISOString(),
      }).catch(() => {});

      return NextResponse.json(
        {
          message: 'Account upgraded to cleaner successfully',
          cleaner: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            status: 'pending_review',
            verificationStatus: result.profile.verificationStatus,
          },
        },
        { status: 201 }
      );
    }

    // Upload profile photo to R2 before the transaction (need userId for key, but
    // for new users we generate a temporary ID first, then update after creation)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email.toLowerCase().trim(),
          // F5: save-side casing normalisation on the route the WEB WIZARD posts
          // to. The earlier fix landed on signup/profile/mobile-onboarding — this
          // create was still writing the raw lowercase input.
          name: displayName(body.name),
          phone: body.phone.trim(),
          role: 'CLEANER',
          passwordHash: body.password ? await bcrypt.hash(body.password, 12) : null,
          image: null,
        },
      });

      const profile = await tx.cleanerProfile.create({
        data: {
          userId: user.id,
          bio: body.bio?.trim() || null,
          hourlyRateRegular: pricingData.hourlyRateRegular,
          hourlyRateDeep: pricingData.hourlyRateDeep,
          hourlyRateSameDay: pricingData.hourlyRateSameDay,
          eotPrices: pricingData.eotPrices || undefined,
          airbnbPrices: pricingData.airbnbPrices || undefined,
          specialties: body.specialties || [],
          languages: body.languages || [],
          serviceTypes: body.serviceTypes || [],
          hoursPerWeek: body.hoursPerWeek ? Number(body.hoursPerWeek) : null,
          yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : null,
          location: homePostcodeNorm,
          postcode: homePostcodeNorm,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          homePostcode: homePostcodeNorm,
          homeLatitude: geo?.latitude ?? null,
          homeLongitude: geo?.longitude ?? null,
          homeGeocodedAt: geo ? new Date() : null,
          maxTravelMinutes,
          radius: 10,
          travelMode: body.travelMode || 'public_transport',
          verificationStatus: 'PENDING',
          acknowledgmentVersion: CURRENT_AGREEMENT_VERSION,
          rightToWorkDocType: body.rightToWorkDocType || null,
          rightToWorkShareCode: body.rightToWorkShareCode || null,
          rightToWorkExpiresAt: body.rightToWorkExpiryDate
            ? new Date(body.rightToWorkExpiryDate)
            : null,
          dbsCertNumber: body.dbsCertNumber?.trim() || null,
          dbsCertIssueDate: body.dbsCertIssueDate ? new Date(body.dbsCertIssueDate) : null,
          rightToWorkStatus: body.rightToWorkDocType ? 'PENDING' : 'UNVERIFIED',
          verificationMeta: body.selfiePhoto
            ? { livenessComplete: true, dbsOption: body.dbsOption || null }
            : body.dbsOption
              ? { dbsOption: body.dbsOption }
              : undefined,
        },
      });

      // A14: append-only acknowledgment evidence (version + hash + IP + time).
      await tx.agreementAcceptance.create({
        data: {
          cleanerId: user.id,
          agreementVersion: CURRENT_AGREEMENT_VERSION,
          textHash: currentAgreementHash(),
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return { user, profile };
    });

    // Upload profile photo to R2 after user creation (need the real userId for
    // the key). Already content-verified + size-checked up-front.
    if (photoUpload) {
      const photoKey = await uploadProfilePhoto(
        result.user.id,
        photoUpload.buffer,
        photoUpload.mime
      );
      if (photoKey) {
        await prisma.user.update({
          where: { id: result.user.id },
          data: { image: photoKey },
        });
      }
    }

    await AuditService.log({
      userId: result.user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: result.user.id,
      metadata: { role: 'CLEANER', email: body.email },
    });

    await AuditService.log({
      userId: result.user.id,
      action: 'CLEANER_PROFILE_UPDATED',
      entityType: 'CleanerProfile',
      entityId: result.profile.id,
      metadata: {
        event: 'onboarding_submitted',
        dbsOption: body.dbsOption || null,
        hasRtwDoc: !!body.rightToWorkDocType,
        hasSelfie: !!body.selfiePhoto,
      },
    });

    if (
      body.selfiePhoto &&
      typeof body.selfiePhoto === 'string' &&
      body.selfiePhoto.startsWith('data:image/')
    ) {
      // F13: header-only regex — /(.+)$/ over a multi-MB selfie base64 string
      // overflows the regex stack (RangeError) and 500s the whole signup.
      const selfieComma = body.selfiePhoto.indexOf(',');
      const selfieHeader = selfieComma > 0 ? body.selfiePhoto.slice(0, selfieComma) : '';
      const match = selfieHeader.match(/^data:image\/(\w+);base64$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(body.selfiePhoto.slice(selfieComma + 1), 'base64');
        await DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'selfie',
          fileBuffer: buffer,
          originalName: `selfie.${ext}`,
          mimeType: `image/${match[1]}`,
        }).catch(() => {});
      }
    }

    sendSignupNotification({
      name: result.user.name || body.name,
      email: result.user.email,
      phone: body.phone?.trim() || '',
      role: 'CLEANER',
      createdAt: result.user.createdAt.toISOString(),
    }).catch(() => {});

    return NextResponse.json(
      {
        message: 'Application submitted successfully',
        cleaner: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          status: 'pending_review',
          verificationStatus: result.profile.verificationStatus,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Cleaners] POST error:', error);
    return NextResponse.json(
      { error: 'Something went wrong processing your application. Please try again.' },
      { status: 500 }
    );
  }
}
