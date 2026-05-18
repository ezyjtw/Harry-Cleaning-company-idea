import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * POST /api/cleaners/payout — Create or retrieve a Stripe Connect onboarding link
 *
 * Stripe Connect enables cleaners to set up their own payout account
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

    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      return NextResponse.json({
        onboardingUrl: null,
        mock: true,
        message: 'Stripe not configured — payout setup will be available in production',
        status: 'not_configured',
      });
    }

    const meta = (profile.verificationMeta as Record<string, unknown>) || {};
    const existingAccountId = meta.stripeAccountId as string | undefined;

    if (existingAccountId) {
      const res = await fetch(`${STRIPE_API_BASE}/accounts/${existingAccountId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.charges_enabled && data.payouts_enabled) {
          return NextResponse.json({
            status: 'active',
            message: 'Payout account is already set up and active',
            accountId: existingAccountId,
          });
        }

        // Account exists but not fully onboarded — create a new account link
        const linkBody = new URLSearchParams({
          account: existingAccountId,
          refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cleaner/profile`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cleaners/payout/callback?cleanerId=${cleanerId}`,
          type: 'account_onboarding',
        });

        const linkRes = await fetch(`${STRIPE_API_BASE}/account_links`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${apiKey}`,
          },
          body: linkBody.toString(),
        });

        if (linkRes.ok) {
          const linkData = await linkRes.json();
          return NextResponse.json({
            onboardingUrl: linkData.url,
            accountId: existingAccountId,
            status: 'pending',
          });
        }
      }
    }

    // Create a new Stripe Connect account
    const accountBody = new URLSearchParams({
      type: 'express',
      country: 'GB',
      email: profile.user.email,
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true',
      business_type: 'individual',
      'metadata[cleanerId]': cleanerId,
      'metadata[profileId]': profile.id,
    });

    const res = await fetch(`${STRIPE_API_BASE}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
      },
      body: accountBody.toString(),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      // eslint-disable-next-line no-console
      console.error('[Stripe Connect] Account creation failed:', res.status, errorBody);
      return NextResponse.json({ error: 'Failed to create payout account' }, { status: 502 });
    }

    const accountData = await res.json();

    // Store the account ID on the profile
    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: {
        stripeAccountId: accountData.id,
        verificationMeta: {
          ...(meta as object),
          stripeAccountId: accountData.id,
          stripeOnboardingStatus: 'pending',
        },
      },
    });

    // Create an account link for onboarding
    const linkBody = new URLSearchParams({
      account: accountData.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cleaner/profile`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cleaners/payout/callback?cleanerId=${cleanerId}`,
      type: 'account_onboarding',
    });

    const linkRes = await fetch(`${STRIPE_API_BASE}/account_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`,
      },
      body: linkBody.toString(),
    });

    if (linkRes.ok) {
      const linkData = await linkRes.json();
      return NextResponse.json({
        onboardingUrl: linkData.url,
        accountId: accountData.id,
        status: 'pending',
      });
    }

    return NextResponse.json({
      accountId: accountData.id,
      status: 'pending',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Stripe Connect] Error:', error);
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
    const accountId = (meta.stripeAccountId as string) || profile.stripeAccountId;

    if (!accountId) {
      return NextResponse.json({ status: 'not_started', payoutReady: false });
    }

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json({ status: 'not_configured', payoutReady: false, mock: true });
    }

    const res = await fetch(`${STRIPE_API_BASE}/accounts/${accountId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'unknown', payoutReady: false });
    }

    const data = await res.json();
    return NextResponse.json({
      status: data.charges_enabled && data.payouts_enabled ? 'active' : 'pending',
      payoutReady: data.charges_enabled && data.payouts_enabled,
      accountId,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Stripe Connect] Status check error:', error);
    return NextResponse.json({ error: 'Failed to check payout status' }, { status: 500 });
  }
}
