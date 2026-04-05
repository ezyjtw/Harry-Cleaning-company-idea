import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { DocumentStorageService } from '@/lib/services/document-storage.service';

/**
 * GET /api/admin/documents — List documents pending verification
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get('type') as
    | 'dbs_certificate'
    | 'right_to_work'
    | 'photo_id'
    | 'insurance'
    | null;
  const profileId = searchParams.get('profileId');

  try {
    if (profileId) {
      const docs = await DocumentStorageService.getDocumentsForProfile(profileId);
      return NextResponse.json({ documents: docs });
    }

    const docs = await DocumentStorageService.getPendingVerification(documentType || undefined);
    return NextResponse.json({ documents: docs, count: docs.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminDocuments] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/documents — Verify or reject a document
 */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { documentId, approved } = body;
    // Use verified admin ID from session, not untrusted body
    const adminId = admin.id;

    if (!documentId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'documentId and approved (boolean) are required' },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    await DocumentStorageService.verifyDocument(
      documentId,
      adminId,
      approved,
      ipAddress || undefined
    );

    return NextResponse.json({
      message: approved ? 'Document verified successfully' : 'Document rejected',
      documentId,
      approved,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminDocuments] Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/documents — Destroy a document
 */
export async function DELETE(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { documentId, reason } = body;
    // Use verified admin ID from session
    const adminId = admin.id;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    await DocumentStorageService.destroyDocument(documentId, reason || 'admin_action', adminId);

    return NextResponse.json({ message: 'Document securely destroyed', documentId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminDocuments] Destroy error:', error);
    return NextResponse.json({ error: 'Failed to destroy document' }, { status: 500 });
  }
}
