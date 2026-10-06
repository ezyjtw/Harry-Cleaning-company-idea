import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { DocumentStorageService } from '@/lib/services/document-storage.service';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { accountStatus: true },
  });
  if (!adminUser || adminUser.accountStatus !== 'ACTIVE') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rateLimit = checkRateLimit(`admin-doc-download:${admin.id}`, 60, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many download requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const ipAddress =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

  try {
    const doc = await prisma.documentUpload.findUnique({
      where: { id: params.id },
      select: { id: true, documentType: true, profileId: true, isDestroyed: true },
    });

    if (!doc || doc.isDestroyed) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const result = await DocumentStorageService.getDocument(params.id, admin.id, ipAddress);
    if (!result) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    await AuditService.log({
      userId: admin.id,
      action: 'DOCUMENT_VIEWED',
      entityType: 'DocumentUpload',
      entityId: params.id,
      metadata: {
        documentType: doc.documentType,
        profileId: doc.profileId,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(result.buffer.length),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve document.' }, { status: 500 });
  }
}
