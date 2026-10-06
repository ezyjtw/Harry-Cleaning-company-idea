// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { triggerCatchmentRefresh } from '@/lib/services/catchment-generation.service';
import { DocumentStorageService } from '@/lib/services/document-storage.service';
import { putObject } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';
import { lookupPostcode } from '@/lib/utils/postcode';
import { isSaneHoursPerWeek, isValidPhone, isValidUkPostcode } from '@/lib/validation/inputs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/cleaners/onboarding — Full cleaner onboarding with file uploads
 *
 * Accepts multipart/form-data with both JSON fields and document files.
 * This is the primary endpoint for the mobile cleaner app onboarding flow.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(request, 'cleaner-onboarding', 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many onboarding attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const formData = await request.formData();
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    // Extract text fields
    const name = formData.get('name') as string | null;
    const email = formData.get('email') as string | null;
    const phone = formData.get('phone') as string | null;
    const password = formData.get('password') as string | null;
    const postcode = formData.get('postcode') as string | null;
    const dateOfBirth = formData.get('dateOfBirth') as string | null;
    const bio = formData.get('bio') as string | null;
    const hourlyRateRegularStr = formData.get('hourlyRateRegular') as string | null;
    const hourlyRateDeepStr = formData.get('hourlyRateDeep') as string | null;
    const hourlyRateSameDayStr = formData.get('hourlyRateSameDay') as string | null;
    const hoursPerWeekStr = formData.get('hoursPerWeek') as string | null;
    const serviceTypesStr = formData.get('serviceTypes') as string | null;
    const specialtiesStr = formData.get('specialties') as string | null;
    const languagesStr = formData.get('languages') as string | null;
    const yearsExperienceStr = formData.get('yearsExperience') as string | null;

    // Identity & DBS fields
    const rightToWorkDocType = formData.get('rightToWorkDocType') as string | null;
    const shareCode = formData.get('shareCode') as string | null;
    const expiryDate = formData.get('expiryDate') as string | null;
    const dbsOption = formData.get('dbsOption') as string | null;
    const dbsCertNumber = formData.get('dbsCertNumber') as string | null;
    const dbsIssueDate = formData.get('dbsIssueDate') as string | null;

    // File uploads
    const profilePhoto = formData.get('profilePhoto') as File | null;
    const photoId = formData.get('photoId') as File | null;
    const rightToWorkDoc = formData.get('rightToWorkDoc') as File | null;
    const dbsCertFile = formData.get('dbsCertFile') as File | null;
    const selfiePhoto = formData.get('selfiePhoto') as File | null;

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !postcode?.trim()) {
      return NextResponse.json(
        { error: 'name, email, phone, and postcode are required' },
        { status: 400 }
      );
    }
    // Validation sweep (James): format-check phone + postcode before storing.
    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Enter a valid phone number (7–15 digits, UK or international).' },
        { status: 400 }
      );
    }
    if (!isValidUkPostcode(postcode)) {
      return NextResponse.json({ error: 'Enter a valid UK postcode.' }, { status: 400 });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hourlyRateRegular = Number(hourlyRateRegularStr) || null;
    const hourlyRateDeep = Number(hourlyRateDeepStr) || null;
    const hourlyRateSameDay = Number(hourlyRateSameDayStr) || null;

    // Validate file sizes
    const files = [
      { file: profilePhoto, label: 'Profile photo' },
      { file: photoId, label: 'Photo ID' },
      { file: rightToWorkDoc, label: 'Right to work document' },
      { file: dbsCertFile, label: 'DBS certificate' },
      { file: selfiePhoto, label: 'Selfie photo' },
    ];
    for (const { file, label } of files) {
      if (file && file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${label} exceeds maximum size of 10MB` },
          { status: 400 }
        );
      }
    }

    // Parse arrays
    const serviceTypes = serviceTypesStr ? JSON.parse(serviceTypesStr) : [];
    const specialties = specialtiesStr ? JSON.parse(specialtiesStr) : [];
    const languages = languagesStr ? JSON.parse(languagesStr) : [];

    const geo = await lookupPostcode(postcode.trim());

    // Create User + CleanerProfile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: displayName(name),
          phone: phone.trim(),
          role: 'CLEANER',
          passwordHash: password ? await bcrypt.hash(password, 12) : null,
        },
      });

      const profile = await tx.cleanerProfile.create({
        data: {
          userId: user.id,
          bio: bio?.trim() || null,
          hourlyRateRegular,
          hourlyRateDeep,
          hourlyRateSameDay,
          specialties,
          location: postcode.trim(),
          postcode: postcode.trim(),
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          radius: 10,
          verificationStatus: 'PENDING',
          rightToWorkDocType: rightToWorkDocType || null,
          rightToWorkShareCode: shareCode || null,
          rightToWorkExpiresAt: expiryDate ? new Date(expiryDate) : null,
          dbsCertNumber: dbsCertNumber?.trim() || null,
          dbsCertIssueDate: dbsIssueDate ? new Date(dbsIssueDate) : null,
          verificationMeta: {
            dbsOption: dbsOption || null,
            // H97: the mobile-app flow captures via the device camera; the
            // shell sends selfieProvenance when it knows better.
            livenessComplete:
              !!selfiePhoto && (formData.get('selfieProvenance') as string | null) !== 'upload',
            selfieProvenance: (formData.get('selfieProvenance') as string | null) || 'unknown',
            yearsExperience: parseInt(yearsExperienceStr || '0', 10),
            serviceTypes,
            languages,
            dateOfBirth: dateOfBirth || null,
            hoursPerWeek: isSaneHoursPerWeek(Number(hoursPerWeekStr)) ? Number(hoursPerWeekStr) : 0,
          },
        },
      });

      return { user, profile };
    });

    // Upload documents in parallel (outside transaction to avoid long locks)
    const uploadPromises: Promise<unknown>[] = [];

    if (profilePhoto) {
      const buffer = Buffer.from(await profilePhoto.arrayBuffer());
      // Carry-through fix (James, live testing): the profile photo previously
      // went into the ENCRYPTED document store (as a photo_id doc!) — a field
      // no avatar surface reads, so cleaners were made to re-upload on the
      // profile page (and the wizard photo chipped as "Photo ID · review" in
      // the admin queue). It now lands exactly where the profile page writes:
      // an R2 object at profile-photos/{userId} + User.image — one photo,
      // uploaded once, rendered everywhere.
      const mime = profilePhoto.type || 'image/jpeg';
      const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'jpg';
      const imageKey = `profile-photos/${result.user.id}.${ext}`;
      uploadPromises.push(
        putObject(imageKey, buffer, mime).then(() =>
          prisma.user.update({ where: { id: result.user.id }, data: { image: imageKey } })
        )
      );
    }

    if (photoId) {
      const buffer = Buffer.from(await photoId.arrayBuffer());
      uploadPromises.push(
        DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'photo_id',
          fileBuffer: buffer,
          originalName: photoId.name || 'photo_id.jpg',
          mimeType: photoId.type || 'image/jpeg',
          metadata: { subType: 'identity_document' },
          ipAddress,
        })
      );
    }

    if (rightToWorkDoc) {
      const buffer = Buffer.from(await rightToWorkDoc.arrayBuffer());
      uploadPromises.push(
        DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'right_to_work',
          fileBuffer: buffer,
          originalName: rightToWorkDoc.name || 'right_to_work.pdf',
          mimeType: rightToWorkDoc.type || 'application/pdf',
          expiresAt: expiryDate ? new Date(expiryDate) : undefined,
          metadata: { docType: rightToWorkDocType, shareCode: shareCode ? '***redacted***' : null },
          ipAddress,
        })
      );
    }

    if (dbsCertFile) {
      const buffer = Buffer.from(await dbsCertFile.arrayBuffer());
      uploadPromises.push(
        DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'dbs_certificate',
          fileBuffer: buffer,
          originalName: dbsCertFile.name || 'dbs_certificate.pdf',
          mimeType: dbsCertFile.type || 'application/pdf',
          metadata: {
            certNumber: dbsCertNumber ? `${dbsCertNumber.slice(0, 4)}********` : null,
            issueDate: dbsIssueDate || null,
          },
          ipAddress,
        })
      );
    }

    if (selfiePhoto) {
      const buffer = Buffer.from(await selfiePhoto.arrayBuffer());
      uploadPromises.push(
        DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'photo_id',
          fileBuffer: buffer,
          originalName: selfiePhoto.name || 'selfie.jpg',
          mimeType: selfiePhoto.type || 'image/jpeg',
          metadata: { subType: 'liveness_selfie' },
          ipAddress,
        })
      );
    }

    const uploadResults = await Promise.allSettled(uploadPromises);
    const failedUploads = uploadResults.filter((r) => r.status === 'rejected');
    if (failedUploads.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CleanerOnboarding] ${failedUploads.length} document(s) failed to upload for user ${result.user.id}`
      );
    }

    // B: generate the new cleaner's travel-time isochrone (fire-and-forget;
    // dormant without ORS_API_KEY — the crow-flies fallback covers them).
    triggerCatchmentRefresh(result.user.id);

    // H92: cleaner signup now sends the SAME verification email customers get
    // — this path previously created the user with no token and no send, so
    // cleaners landed unverified forever. Verified email is what guest-booking
    // claim keys on, what password-reset trusts, and what proves the cleaner
    // owns the inbox their payout mail goes to. Fire-and-forget (never blocks
    // the wizard), loud either way per the logging law.
    const { resendEmailVerification } = await import('@/lib/services/auth.service');
    resendEmailVerification(result.user.email)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log(`[CleanerSignup] Verification email queued for ${result.user.email}`);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(`[CleanerSignup] Verification email FAILED for ${result.user.email}:`, e);
      });

    return NextResponse.json(
      {
        message: 'Application submitted successfully',
        cleaner: {
          id: result.user.id,
          profileId: result.profile.id,
          name: result.user.name,
          email: result.user.email,
          status: 'pending_review',
          verificationStatus: result.profile.verificationStatus,
          documentsUploaded: uploadResults.filter((r) => r.status === 'fulfilled').length,
          documentsTotal: uploadPromises.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[CleanerOnboarding] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit application' },
      { status: 500 }
    );
  }
}
