import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { DocumentStorageService } from '@/lib/services/document-storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB base64

function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error('Invalid file format');
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: auth required, and the cleaner is taken from the SESSION — never
    // from the request body. A caller can only upload documents against their own
    // profile (prevents planting forged compliance docs on another cleaner).
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }
    const cleanerId = user.id;

    const body = await request.json();
    const { documentType, fileData } = body;

    if (!documentType || !fileData) {
      return NextResponse.json(
        { error: 'documentType and fileData are required' },
        { status: 400 }
      );
    }

    const validTypes = ['photo_id', 'right_to_work', 'dbs_certificate'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (typeof fileData !== 'string' || !fileData.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid file data' }, { status: 400 });
    }

    if (fileData.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: cleanerId },
      select: { id: true, userId: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
    }

    const { buffer, mimeType } = base64ToBuffer(fileData);

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    const result = await DocumentStorageService.uploadDocument({
      userId: profile.userId,
      profileId: profile.id,
      documentType: documentType as 'photo_id' | 'right_to_work' | 'dbs_certificate',
      fileBuffer: buffer,
      originalName: `${documentType}-${profile.userId}`,
      mimeType,
      ipAddress: ipAddress || undefined,
    });

    return NextResponse.json(
      { message: 'Document uploaded successfully', document: { id: result.id } },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[CleanerDocuments] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
