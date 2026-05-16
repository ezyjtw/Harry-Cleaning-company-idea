import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { DocumentStorageService } from '@/lib/services/document-storage.service';
import { lookupPostcode } from '@/lib/utils/postcode';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/cleaners/onboarding — Full cleaner onboarding with file uploads
 *
 * Accepts multipart/form-data with both JSON fields and document files.
 * This is the primary endpoint for the mobile cleaner app onboarding flow.
 */
export async function POST(request: NextRequest) {
  try {
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
    const hourlyRateStr = formData.get('hourlyRate') as string | null;
    const sameDayRateStr = formData.get('sameDayRate') as string | null;
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

    // Derive hourly rate — default to 15 if missing or invalid
    let hourlyRate = Number(hourlyRateStr) || 0;
    if (!hourlyRate || hourlyRate < 14) hourlyRate = 15;

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
          name: name.trim(),
          phone: phone.trim(),
          role: 'CLEANER',
          passwordHash: password ? await bcrypt.hash(password, 12) : null,
        },
      });

      const profile = await tx.cleanerProfile.create({
        data: {
          userId: user.id,
          bio: bio?.trim() || null,
          hourlyRate,
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
            livenessComplete: !!selfiePhoto,
            yearsExperience: parseInt(yearsExperienceStr || '0', 10),
            serviceTypes,
            languages,
            dateOfBirth: dateOfBirth || null,
            sameDayRate: Number(sameDayRateStr) || Math.round(hourlyRate * 1.3),
            hoursPerWeek: Number(hoursPerWeekStr) || 0,
          },
        },
      });

      return { user, profile };
    });

    // Upload documents in parallel (outside transaction to avoid long locks)
    const uploadPromises: Promise<unknown>[] = [];

    if (profilePhoto) {
      const buffer = Buffer.from(await profilePhoto.arrayBuffer());
      // Store profile photo path on user record
      uploadPromises.push(
        DocumentStorageService.uploadDocument({
          userId: result.user.id,
          profileId: result.profile.id,
          documentType: 'photo_id',
          fileBuffer: buffer,
          originalName: profilePhoto.name || 'profile_photo.jpg',
          mimeType: profilePhoto.type || 'image/jpeg',
          metadata: { subType: 'profile_photo' },
          ipAddress,
        })
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
