import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (dbUser.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(dbUser.stripeCustomerId);
      return NextResponse.json({ stripeCustomerId: dbUser.stripeCustomerId });
    } catch {
      // Customer was deleted on Stripe — fall through to create a new one
    }
  }

  const customer = await stripe.customers.create({
    email: dbUser.email,
    name: dbUser.name || undefined,
    metadata: { userId: dbUser.id },
  });

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { stripeCustomerId: customer.id },
  });

  return NextResponse.json({ stripeCustomerId: customer.id });
}
