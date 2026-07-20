import type { EvidenceType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { DisputeEvidenceService } from '@/lib/services/dispute-evidence.service';
import { putObject } from '@/lib/storage/r2-client';
import { encryptDocument, computeChecksum, generateKeyId } from '@/lib/utils/document-encryption';
import { validateFileType, MAX_EVIDENCE_SIZE } from '@/lib/utils/file-validation';

type RouteContext = { params: Promise<{ id: string }> };

// A dispute in a terminal state no longer accepts new evidence.
const CLOSED_STATUSES = ['RESOLVED', 'DISMISSED'];

// The magic-byte validator (validateFileType) currently whitelists images + PDF
// only, so the detected MIME maps onto two of the four EvidenceType values:
//   image/jpeg|png|webp → PHOTO,  application/pdf → DOCUMENT.
// VIDEO/TEXT are unreachable until the shared validator learns those signatures.
function mapMimeToEvidenceType(detectedMime: string): EvidenceType {
  return detectedMime === 'application/pdf' ? 'DOCUMENT' : 'PHOTO';
}

// The object-key extension is derived from the *validated* content type, never
// from the user-supplied filename — the viewer infers its Content-Type from this
// key, so a filename/MIME mismatch or an injected extension must not reach it.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const MAX_DESCRIPTION_LENGTH = 1000;

const GUEST_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser();
    const guestToken = new URL(request.url).searchParams.get('token');
    if (!user && !(guestToken && GUEST_TOKEN_RE.test(guestToken))) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { id: disputeId } = await context.params;

    const ip = getClientIp(request);
    const rl = checkRateLimit(
      `dispute-evidence:${user ? user.id : `guest:${guestToken}`}`,
      20,
      60 * 60 * 1000
    );
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
    }

    // Ownership: uploader must be a party to the dispute's booking (client or
    // cleaner — both may need to submit proof), an admin, or — H69 — the
    // booking's GUEST customer proving themselves with the booking token
    // (the H8 matrix standard: the token IS the authorization).
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { booking: { select: { clientId: true, cleanerId: true, guestToken: true } } },
    });
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    }

    const isGuestParty =
      !user &&
      !!guestToken &&
      !dispute.booking.clientId &&
      dispute.booking.guestToken === guestToken;
    const isParty =
      !!user && (dispute.booking.clientId === user.id || dispute.booking.cleanerId === user.id);
    if (!isGuestParty && !isParty && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Reject evidence on a resolved/closed dispute.
    if (CLOSED_STATUSES.includes(dispute.status)) {
      return NextResponse.json(
        { error: 'This dispute is closed and no longer accepts evidence.' },
        { status: 409 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    // H23: duck-type, never `instanceof File` — the global's absence on the
    // old Node 18 runtime made the instanceof itself throw (500 on every
    // upload). Same fix as the imported-review evidence route.
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const description = formData.get('description');
    if (typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: 'Description too long. Maximum is 1000 characters.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_EVIDENCE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-byte validation — rejects spoofed MIME types and SVG/XML.
    const validation = validateFileType(buffer, file.type);
    if (!validation.valid || !validation.detectedMime) {
      return NextResponse.json(
        { error: validation.error || 'Unable to verify file type.' },
        { status: 400 }
      );
    }

    // Encrypt and upload to R2 with a non-enumerable key.
    const keyId = generateKeyId();
    const checksum = computeChecksum(buffer);
    const encrypted = encryptDocument(buffer, keyId);

    const ext = EXT_BY_MIME[validation.detectedMime] ?? '';
    const objectKey = `evidence/${disputeId}/${keyId}${ext}.enc`;

    await putObject(objectKey, encrypted, 'application/octet-stream');

    // H69: null uploadedBy = the booking's guest customer.
    const evidence = await DisputeEvidenceService.addDisputeEvidence(disputeId, user?.id ?? null, {
      type: mapMimeToEvidenceType(validation.detectedMime),
      url: objectKey,
      fileName: file.name,
      description:
        typeof description === 'string' && description.trim() ? description.trim() : undefined,
    });

    AuditService.log({
      action: 'DISPUTE_EVIDENCE_UPLOADED',
      userId: user?.id,
      entityType: 'DisputeEvidence',
      entityId: evidence.id,
      metadata: {
        disputeId,
        objectKey,
        originalName: file.name,
        mimeType: validation.detectedMime,
        fileSize: file.size,
        checksum,
      },
      ipAddress: ip,
    }).catch(() => {});

    // Return the evidence record with a viewer URL (never the raw R2 key).
    return NextResponse.json(
      {
        evidence: {
          id: evidence.id,
          type: evidence.type,
          fileName: evidence.fileName,
          description: evidence.description,
          uploadedAt: evidence.uploadedAt,
          url: `/api/disputes/${disputeId}/evidence/${evidence.id}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // H23: no more silent 500s on this family of routes.
    // eslint-disable-next-line no-console
    console.error('[DisputeEvidence] Request failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
