import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { GdprService } from '@/lib/services/gdpr.service';
import type { ConsentType } from '@/lib/services/gdpr.service';

const VALID_CONSENT_TYPES: ConsentType[] = [
  'marketing',
  'analytics',
  'essential',
  'data_processing',
];

// ─── POST /api/gdpr/consent ─────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, consents } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    if (!consents || !Array.isArray(consents)) {
      return NextResponse.json(
        { error: 'consents must be an array of { type, granted }' },
        { status: 400 }
      );
    }

    // Validate consent types
    for (const consent of consents) {
      if (!VALID_CONSENT_TYPES.includes(consent.type)) {
        return NextResponse.json(
          { error: `Invalid consent type: ${consent.type}` },
          { status: 400 }
        );
      }
      if (typeof consent.granted !== 'boolean') {
        return NextResponse.json(
          { error: 'Each consent must have a boolean "granted" field' },
          { status: 400 }
        );
      }
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress =
      forwarded?.split(',').pop()?.trim() ?? request.headers.get('x-real-ip') ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    // SECURITY: the cookie-consent banner posts anonymously (no session), so we
    // can't require auth here. But we must not let a caller bind a consent record
    // to someone else's account: if there IS a session, force the identity to the
    // session user; if there is NOT, never trust a body-supplied userId.
    const sessionUser = await getSessionUser();
    const effectiveUserId = sessionUser ? sessionUser.id : undefined;
    const effectiveEmail = sessionUser?.email
      ? sessionUser.email.trim().toLowerCase()
      : email.trim().toLowerCase();

    const results = await GdprService.recordBulkConsent({
      userId: effectiveUserId,
      email: effectiveEmail,
      consents,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, recorded: results.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Consent recording error:', error);
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
  }
}

// ─── GET /api/gdpr/consent?userId=xxx or ?email=xxx ──

export async function GET(request: NextRequest) {
  try {
    // SECURITY: consent history is personal data — require auth and restrict to
    // the requester's own records unless they are an admin.
    const requester = await getSessionUser();
    if (!requester) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId') ?? undefined;
    const requestedEmail = searchParams.get('email') ?? undefined;

    const isAdmin = requester.role === 'ADMIN';
    const ownEmail = requester.email.trim().toLowerCase();

    if (!isAdmin) {
      const targetsSelf =
        (!requestedUserId && !requestedEmail) ||
        requestedUserId === requester.id ||
        requestedEmail?.trim().toLowerCase() === ownEmail;
      if (!targetsSelf) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
    }

    const userId = isAdmin ? requestedUserId : requester.id;
    const email = isAdmin ? requestedEmail : (requestedEmail ?? ownEmail);

    const status = await GdprService.getConsentStatus({ userId, email });
    return NextResponse.json({ status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Consent status error:', error);
    return NextResponse.json({ error: 'Failed to get consent status' }, { status: 500 });
  }
}
