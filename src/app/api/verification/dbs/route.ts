import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { DBSVerificationService } from '@/lib/services/dbs-verification.service';
import { decodeBase64File, IMAGE_MIMES } from '@/lib/utils/file-validation';

/**
 * GET /api/verification/dbs — Get DBS verification status for the authenticated cleaner.
 */
export async function GET() {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await DBSVerificationService.getVerificationStatus(user.id);
    if (!status) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
    }

    return NextResponse.json({ verification: status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[DBSVerification] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch verification status' }, { status: 500 });
  }
}

/**
 * POST /api/verification/dbs — Submit a DBS verification action.
 *
 * Body must include an `action` field:
 *  - "liveness_check" — perform identity/liveness verification
 *
 * F13: the previously-advertised "verify_existing" / "apply_new" actions were
 * never implemented (they fell through to the invalid-action 400) and have no
 * callers — the docstring no longer advertises capabilities that don't exist.
 * GET (status) + liveness_check are the complete surface.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCleanerSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    // Look up the cleaner profile
    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
    }

    // --- Liveness / identity check ---
    if (action === 'liveness_check') {
      const { selfieImage, idImage, fullName, dateOfBirth, documentNumber } = body;

      if (!selfieImage || !idImage) {
        return NextResponse.json(
          { error: 'selfieImage and idImage (base64) are required' },
          { status: 400 }
        );
      }

      // Content-verify both images (JPEG/PNG/WebP only), bound their size.
      const selfieCheck = decodeBase64File(selfieImage, {
        allowed: IMAGE_MIMES,
        typeLabel: 'a JPG or PNG photo',
      });
      if (!selfieCheck.ok) {
        return NextResponse.json({ error: `Selfie: ${selfieCheck.error}` }, { status: 400 });
      }
      const idCheck = decodeBase64File(idImage, {
        allowed: IMAGE_MIMES,
        typeLabel: 'a JPG or PNG photo',
      });
      if (!idCheck.ok) {
        return NextResponse.json({ error: `ID photo: ${idCheck.error}` }, { status: 400 });
      }

      const result = await DBSVerificationService.performLivenessCheck({
        userId: user.id,
        profileId: profile.id,
        selfieImageBase64: selfieImage,
        idImageBase64: idImage,
        fullName: fullName || user.name,
        dateOfBirth,
        documentNumber,
        ipAddress: ipAddress || undefined,
      });

      return NextResponse.json({ result }, { status: result.success ? 200 : 500 });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be: liveness_check' },
      { status: 400 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[DBSVerification] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process verification request' },
      { status: 500 }
    );
  }
}
