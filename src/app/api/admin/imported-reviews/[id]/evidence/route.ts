import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { getObject } from '@/lib/storage/r2-client';
import { decryptDocument, computeChecksum } from '@/lib/utils/document-encryption';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function inferMime(objectKey: string): string {
  const withoutEnc = objectKey.endsWith('.enc') ? objectKey.slice(0, -4) : objectKey;
  const extDot = withoutEnc.lastIndexOf('.');
  if (extDot >= 0) {
    const ext = withoutEnc.slice(extDot).toLowerCase();
    return MIME_BY_EXT[ext] ?? 'application/octet-stream';
  }
  return 'application/octet-stream';
}

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

  const rl = checkRateLimit(`admin-evidence-download:${admin.id}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many download requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const review = await prisma.importedReview.findUnique({
      where: { id: params.id },
      select: { id: true, evidenceUrl: true, cleanerId: true, source: true },
    });

    if (!review || !review.evidenceUrl) {
      return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    }

    const encrypted = await getObject(review.evidenceUrl);

    // Extract keyId from the object key path:
    // imported-review-evidence/{cleanerId}/{keyId}{ext}.enc
    const pathParts = review.evidenceUrl.split('/');
    const filename = pathParts[pathParts.length - 1]; // e.g. "abc123.pdf.enc"
    const withoutEnc = filename.endsWith('.enc') ? filename.slice(0, -4) : filename;
    const dotIdx = withoutEnc.indexOf('.');
    const keyId = dotIdx >= 0 ? withoutEnc.slice(0, dotIdx) : withoutEnc;

    const decrypted = decryptDocument(encrypted, keyId);

    const checksum = computeChecksum(decrypted);

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    await AuditService.log({
      userId: admin.id,
      action: 'IMPORTED_REVIEW_EVIDENCE_VIEWED',
      entityType: 'ImportedReview',
      entityId: params.id,
      metadata: {
        cleanerId: review.cleanerId,
        source: review.source,
        checksum,
      },
      ipAddress,
    });

    const mimeType = inferMime(review.evidenceUrl);

    return new Response(new Uint8Array(decrypted), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(decrypted.length),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve evidence.' }, { status: 500 });
  }
}
