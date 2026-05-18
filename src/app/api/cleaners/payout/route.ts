import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

const RYFT_API_BASE = 'https://api.ryftpay.com/v1';

/**
 * POST /api/cleaners/payout — Create or retrieve a Ryft Connect onboarding link
 *
 * Ryft Connect enables cleaners to set up their own payout account
 * so they can receive earnings directly to their bank account.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cleanerId } = body;

    if (!cleanerId) {
      return NextResponse.json({ error: 'cleanerId is required' }, { status: 400 });
    }

    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: cleanerId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
    }

    const apiKey = process.env.RYFT_SECRET_KEY;

    if (!apiKey) {
      // Dev/mock mode — return a simulated onboarding link
      return NextResponse.json({
        onboardingUrl: null,
        mock: true,
        message: 'Ryft not configured — payout setup will be available in production',
        status: 'not_configured',
      });
    }

    // Check if cleaner already has a Ryft sub-account
    const meta = (profile.verificationMeta as Record<string, unknown>) || {};
    const existingSubAccountId = meta.ryftSubAccountId as string | undefined;

    if (existingSubAccountId) {
      // Retrieve existing sub-account status
      const res = await fetch(`${RYFT_API_BASE}/sub-accounts/${existingSubAccountId}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'active') {
          return NextResponse.json({
            status: 'active',
            message: 'Payout account is already set up and active',
            subAccountId: existingSubAccountId,
          });
        }
      }
    }

    // Create a new Ryft Connect onboarding session
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cleaners/payout/callback?cleanerId=${cleanerId}`;

    const res = await fetch(`${RYFT_API_BASE}/sub-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        name: profile.user.name,
        email: profile.user.email,
        type: 'individual',
        metadata: { cleanerId, profileId: profile.id },
        returnUrl,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      // eslint-disable-next-line no-console
      console.error('[Ryft Connect] Sub-account creation failed:', res.status, errorBody);
      return NextResponse.json({ error: 'Failed to create payout account' }, { status: 502 });
    }

    const data = await res.json();

    // Store the sub-account ID on the profile
    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: {
        verificationMeta: {
          ...(meta as object),
          ryftSubAccountId: data.id,
          ryftOnboardingStatus: data.status,
        },
      },
    });

    return NextResponse.json({
      onboardingUrl: data.onboardingUrl || data.url,
      subAccountId: data.id,
      status: data.status,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Ryft Connect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set up payout' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cleaners/payout — Check payout setup status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cleanerId = searchParams.get('cleanerId');

  if (!cleanerId) {
    return NextResponse.json({ error: 'cleanerId is required' }, { status: 400 });
  }

  try {
    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: cleanerId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
    }

    const meta = (profile.verificationMeta as Record<string, unknown>) || {};
    const subAccountId = meta.ryftSubAccountId as string | undefined;

    if (!subAccountId) {
      return NextResponse.json({ status: 'not_started', payoutReady: false });
    }

    const apiKey = process.env.RYFT_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json({ status: 'not_configured', payoutReady: false, mock: true });
    }

    const res = await fetch(`${RYFT_API_BASE}/sub-accounts/${subAccountId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'unknown', payoutReady: false });
    }

    const data = await res.json();
    return NextResponse.json({
      status: data.status,
      payoutReady: data.status === 'active',
      subAccountId,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Ryft Connect] Status check error:', error);
    return NextResponse.json({ error: 'Failed to check payout status' }, { status: 500 });
  }
}
