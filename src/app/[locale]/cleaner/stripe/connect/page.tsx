import { redirect } from 'next/navigation';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export default async function StripeConnectPage() {
  const user = await getCleanerSession();
  if (!user) {
    redirect('/login');
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

  // H55: the two-stage flow explicitly invites payouts setup DURING the
  // verification wait ("while we verify your identity, get ready to go live").
  // Requiring VERIFIED here contradicted that — a pending cleaner clicking
  // "Set up payouts" was 307'd straight back to /cleaner (the dead-click /
  // redirects-wrong symptom). Stripe Express onboarding is independent of Rena
  // verification, so any authenticated cleaner with a profile may start it.
  if (!profile) {
    redirect('/en/cleaner');
  }

  if (profile.stripeChargesEnabled && profile.stripePayoutsEnabled) {
    redirect('/en/cleaner/onboarding-complete');
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

  redirect(accountLink.url);
}
