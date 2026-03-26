import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { DocumentStorageService } from '@/lib/services/document-storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * POST /api/documents — Upload an encrypted document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const profileId = formData.get('profileId') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const expiresAt = formData.get('expiresAt') as string | null;
    const metadataStr = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (
      !documentType ||
      !['dbs_certificate', 'right_to_work', 'photo_id', 'insurance'].includes(documentType)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid documentType. Must be: dbs_certificate, right_to_work, photo_id, or insurance',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    let metadata: Record<string, unknown> | undefined;
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    }

    const result = await DocumentStorageService.uploadDocument({
      userId,
      profileId: profileId || undefined,
      documentType: documentType as 'dbs_certificate' | 'right_to_work' | 'photo_id' | 'insurance',
      fileBuffer: buffer,
      originalName: file.name,
      mimeType: file.type,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
      ipAddress: ipAddress || undefined,
    });

    return NextResponse.json(
      { message: 'Document uploaded and encrypted successfully', document: result },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[DocumentUpload] Error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
