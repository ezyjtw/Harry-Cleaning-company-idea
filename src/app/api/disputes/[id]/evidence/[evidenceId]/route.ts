import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { getObject } from '@/lib/storage/r2-client';
import { decryptDocument } from '@/lib/utils/document-encryption';

type RouteContext = { params: Promise<{ id: string; evidenceId: string }> };

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// Object keys are `evidence/{disputeId}/{keyId}{ext}.enc`. Strip `.enc`, read
// the real extension, and derive the keyId used to encrypt.
function inferMime(objectKey: string): string {
  const withoutEnc = objectKey.endsWith('.enc') ? objectKey.slice(0, -4) : objectKey;
  const extDot = withoutEnc.lastIndexOf('.');
  if (extDot >= 0) {
    return MIME_BY_EXT[withoutEnc.slice(extDot).toLowerCase()] ?? 'application/octet-stream';
  }
  return 'application/octet-stream';
}

function keyIdFromObjectKey(objectKey: string): string {
  const filename = objectKey.split('/').pop() ?? objectKey;
  const withoutEnc = filename.endsWith('.enc') ? filename.slice(0, -4) : filename;
  const dotIdx = withoutEnc.indexOf('.');
  return dotIdx >= 0 ? withoutEnc.slice(0, dotIdx) : withoutEnc;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { id: disputeId, evidenceId } = await context.params;
  const download = new URL(request.url).searchParams.get('download') === '1';

  const rl = checkRateLimit(`dispute-evidence-view:${user.id}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const evidence = await prisma.disputeEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        dispute: { include: { booking: { select: { clientId: true, cleanerId: true } } } },
      },
    });

    // Guard against a mismatched dispute/evidence pair in the URL.
    if (!evidence || evidence.disputeId !== disputeId) {
      return NextResponse.json({ error: 'Evidence not found.' }, { status: 404 });
    }

    // Access: a party to the dispute's booking (client or cleaner), or an admin.
    const isParty =
      evidence.dispute.booking.clientId === user.id ||
      evidence.dispute.booking.cleanerId === user.id;
    if (!isParty && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const encrypted = await getObject(evidence.url);
    const decrypted = decryptDocument(encrypted, keyIdFromObjectKey(evidence.url));

    AuditService.log({
      action: 'DISPUTE_EVIDENCE_VIEWED',
      userId: user.id,
      entityType: 'DisputeEvidence',
      entityId: evidence.id,
      metadata: { disputeId },
      ipAddress: getClientIp(request),
    }).catch(() => {});

    return new Response(new Uint8Array(decrypted), {
      status: 200,
      headers: {
        'Content-Type': inferMime(evidence.url),
        'Content-Length': String(decrypted.length),
        'Content-Disposition': download
          ? `attachment; filename="${(evidence.fileName || 'evidence').replace(/[^\w.\-]/g, '_')}"`
          : 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve evidence.' }, { status: 500 });
  }
}
