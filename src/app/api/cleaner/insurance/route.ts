import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { DocumentStorageService } from '@/lib/services/document-storage.service';
import { decodeBase64File, DOCUMENT_MIMES } from '@/lib/utils/file-validation';

export async function GET() {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: {
        insuranceVerified: true,
        insuranceExpiresAt: true,
        insuranceVerifiedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const document = await prisma.documentUpload.findFirst({
      where: {
        userId: user.id,
        documentType: 'insurance',
        isDestroyed: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        createdAt: true,
        expiresAt: true,
        isVerified: true,
        metadata: true,
      },
    });

    const now = new Date();
    const isExpired = profile.insuranceExpiresAt ? profile.insuranceExpiresAt < now : false;
    const daysUntilExpiry = profile.insuranceExpiresAt
      ? Math.ceil((profile.insuranceExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      insuranceVerified: profile.insuranceVerified && !isExpired,
      insuranceExpiresAt: profile.insuranceExpiresAt,
      insuranceVerifiedAt: profile.insuranceVerifiedAt,
      isExpired,
      daysUntilExpiry,
      document: document
        ? {
            id: document.id,
            fileName: document.originalName,
            uploadedAt: document.createdAt,
            expiresAt: document.expiresAt,
            isVerified: document.isVerified,
          }
        : null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Insurance] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch insurance status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, verified: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fileData, fileName, expiryDate } = body;

    if (!fileData || !fileName) {
      return NextResponse.json({ error: 'fileData and fileName are required' }, { status: 400 });
    }

    if (!expiryDate) {
      return NextResponse.json({ error: 'Policy expiry date is required' }, { status: 400 });
    }

    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      return NextResponse.json(
        { error: 'Policy expiry date must be in the future' },
        { status: 400 }
      );
    }

    // Content-verify the certificate (PDF or image) and bound its size. The
    // stored MIME is the detected one, not the client-claimed `mimeType`.
    const fileCheck = decodeBase64File(fileData, {
      allowed: DOCUMENT_MIMES,
      typeLabel: 'a PDF, JPG, or PNG file',
    });
    if (!fileCheck.ok) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 });
    }

    const document = await DocumentStorageService.uploadDocument({
      userId: user.id,
      profileId: profile.id,
      documentType: 'insurance',
      fileBuffer: fileCheck.buffer,
      originalName: fileName,
      mimeType: fileCheck.mime,
      expiresAt: expiry,
      metadata: { policyExpiryDate: expiryDate },
    });

    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: {
        insuranceExpiresAt: expiry,
      },
    });

    // Insurance follow-through (James): when insurance lands on an ALREADY
    // VERIFIED cleaner it's a go-live review the admin must action — surface it
    // in the admin bell so the queue isn't relying on someone wandering in.
    if (profile.verified) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      await Promise.all(
        admins.map((admin) =>
          prisma.notification
            .create({
              data: {
                userId: admin.id,
                type: 'ACCOUNT_UPDATE',
                title: 'Insurance to review',
                body: `${user.name || 'A verified cleaner'} uploaded insurance for go-live review.`,
                data: { url: '/admin/verification' },
              },
            })
            .catch(() => null)
        )
      );
    }

    return NextResponse.json(
      {
        message: 'Insurance document uploaded successfully',
        document: {
          id: document.id,
          fileName: document.originalName,
          expiresAt: expiry,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Insurance] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload insurance document' }, { status: 500 });
  }
}
