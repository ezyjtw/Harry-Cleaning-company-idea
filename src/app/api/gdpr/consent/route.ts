import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
    const { userId, email, consents } = body;

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
      forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    const results = await GdprService.recordBulkConsent({
      userId,
      email: email.trim().toLowerCase(),
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') ?? undefined;
    const email = searchParams.get('email') ?? undefined;

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }

    const status = await GdprService.getConsentStatus({ userId, email });
    return NextResponse.json({ status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Consent status error:', error);
    return NextResponse.json({ error: 'Failed to get consent status' }, { status: 500 });
  }
}
