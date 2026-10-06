import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { DocumentStorageService } from '@/lib/services/document-storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB base64

function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  // F13: regex the tiny HEADER only. Running /(.+)$/ across the whole payload
  // blows V8's regex stack on phone-sized photos (~7MB base64) — RangeError →
  // 500 for every large upload, while small test files sailed through.
  const comma = dataUrl.indexOf(',');
  const header = comma > 0 ? dataUrl.slice(0, comma) : '';
  const match = header.match(/^data:([^;]+);base64$/);
  if (!match) throw new Error('Invalid file format');
  return {
    mimeType: match[1],
    buffer: Buffer.from(dataUrl.slice(comma + 1), 'base64'),
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

    // F13: 'selfie' included — the wizard stores selfies server-side, but the
    // inline rejected-doc re-upload (F8) posts them here; without it, a selfie
    // rejection was a dead end ('Invalid document type' regardless of file).
    const validTypes = ['photo_id', 'right_to_work', 'dbs_certificate', 'selfie'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        {
          error: `Unknown document type "${documentType}" — expected one of: ${validTypes.join(', ')}.`,
        },
        { status: 400 }
      );
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
      documentType: documentType as 'photo_id' | 'right_to_work' | 'dbs_certificate' | 'selfie',
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
