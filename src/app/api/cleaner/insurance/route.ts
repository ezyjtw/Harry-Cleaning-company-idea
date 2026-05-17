import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { DocumentStorageService } from '@/lib/services/document-storage.service';

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
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fileData, fileName, mimeType, expiryDate } = body;

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

    const fileBuffer = Buffer.from(fileData, 'base64');

    const document = await DocumentStorageService.uploadDocument({
      userId: user.id,
      profileId: profile.id,
      documentType: 'insurance',
      fileBuffer,
      originalName: fileName,
      mimeType: mimeType || 'application/pdf',
      expiresAt: expiry,
      metadata: { policyExpiryDate: expiryDate },
    });

    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: {
        insuranceExpiresAt: expiry,
      },
    });

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
