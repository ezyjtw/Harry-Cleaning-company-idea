// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export async function POST() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      verificationStatus: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Cleaner profile not found' }, { status: 404 });
  }

  // H55: mirror the connect page — payouts setup is available during the
  // verification wait (the two-stage go-live flow), so this door no longer
  // gates on VERIFIED. Stripe Express onboarding is independent of Rena
  // verification. (This endpoint currently has no in-repo callers; relaxed for
  // consistency so the two payout doors never diverge.)

  if (profile.stripeAccountId && profile.stripeChargesEnabled && profile.stripePayoutsEnabled) {
    return NextResponse.json(
      { error: 'Your payment account is already fully connected.' },
      { status: 400 }
    );
  }

  let stripeAccountId = profile.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: user.email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    stripeAccountId = account.id;

    await prisma.cleanerProfile.update({
      where: { id: profile.id },
      data: { stripeAccountId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/en/cleaner/stripe/connect`,
    return_url: `${appUrl}/en/cleaner/onboarding-complete`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
