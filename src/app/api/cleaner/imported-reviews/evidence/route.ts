import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { putObject } from '@/lib/storage/r2-client';
import { encryptDocument, computeChecksum, generateKeyId } from '@/lib/utils/document-encryption';
import { validateFileType, MAX_EVIDENCE_SIZE } from '@/lib/utils/file-validation';

export async function POST(request: Request) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const ip = getClientIp(request);
    const rl = checkRateLimit(`imported-review-evidence:${user.id}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    // H23: duck-type instead of `instanceof File` — on Node 18 (what Railway
    // ran before the engines pin) there is no global File, so the instanceof
    // itself threw and every evidence upload 500'd. The runtime is now pinned
    // to 22, but the check must never again depend on a global's existence.
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (file.size > MAX_EVIDENCE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-byte validation — rejects spoofed MIME types and SVG/XML
    const validation = validateFileType(buffer, file.type);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Encrypt and upload to R2 with non-enumerable key
    const keyId = generateKeyId();
    const checksum = computeChecksum(buffer);
    const encrypted = encryptDocument(buffer, keyId);

    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    // Key path includes cleanerId — ownership is baked into the storage path
    const objectKey = `imported-review-evidence/${user.id}/${keyId}${ext}.enc`;

    await putObject(objectKey, encrypted, 'application/octet-stream');

    AuditService.log({
      action: 'IMPORTED_REVIEW_EVIDENCE_UPLOADED',
      userId: user.id,
      entityType: 'ImportedReviewEvidence',
      entityId: keyId,
      metadata: {
        objectKey,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        checksum,
      },
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({ evidenceUrl: objectKey, checksum }, { status: 201 });
  } catch (error) {
    // H23: this catch used to be silent — James's live 500 left NOTHING in the
    // runtime logs and cost the diagnosis an hour of edge-log archaeology.
    // eslint-disable-next-line no-console
    console.error('[ImportedReviewEvidence] Upload failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
