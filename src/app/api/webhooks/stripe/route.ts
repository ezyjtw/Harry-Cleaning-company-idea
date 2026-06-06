import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    // eslint-disable-next-line no-console
    console.error('[Stripe Webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });

  if (existing) {
    return NextResponse.json({ received: true });
  }

  await prisma.stripeWebhookEvent.create({
    data: {
      id: event.id,
      type: event.type,
      payload: JSON.parse(rawBody),
    },
  });

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;

    const profile = await prisma.cleanerProfile.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (profile) {
      const updateData: {
        stripeChargesEnabled: boolean;
        stripePayoutsEnabled: boolean;
        stripeOnboardedAt?: Date;
      } = {
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
      };

      if (account.charges_enabled && account.payouts_enabled && !profile.stripeOnboardedAt) {
        updateData.stripeOnboardedAt = new Date();
      }

      await prisma.cleanerProfile.update({
        where: { stripeAccountId: account.id },
        data: updateData,
      });
    }
  }

  if (event.type === 'account.application.deauthorized') {
    const stripeAccountId = event.account;
    if (stripeAccountId) {
      await prisma.cleanerProfile.updateMany({
        where: { stripeAccountId },
        data: {
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
