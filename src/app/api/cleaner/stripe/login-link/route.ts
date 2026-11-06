import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { log } from '@/lib/log';
import stripe from '@/lib/stripe';

// P1 (ledger, the boundary-audit gap): Stripe Express login link — lets a
// connected cleaner open their Stripe Express dashboard to see payout history.
// Read-only door: createLoginLink mints a short-lived URL for an EXISTING
// Express account; it moves no money and changes no account state.
export async function POST() {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: user.id },
    select: { stripeAccountId: true },
  });

  if (!profile?.stripeAccountId) {
    return NextResponse.json(
      { error: 'Set up payouts first — your payment account is not connected yet.' },
      { status: 400 }
    );
  }

  try {
    const link = await stripe.accounts.createLoginLink(profile.stripeAccountId);
    return NextResponse.json({ url: link.url });
  } catch (error) {
    log.error('stripe_login_link', 'failed_for_user', {}, error);
    return NextResponse.json(
      { error: 'Could not open your payouts dashboard. Please try again.' },
      { status: 502 }
    );
  }
}
