import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import stripe from '@/lib/stripe';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return NextResponse.json({ paymentMethods: [] });
  }

  const methods = await stripe.paymentMethods.list({
    customer: dbUser.stripeCustomerId,
    type: 'card',
  });

  const paymentMethods = methods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand || 'unknown',
    last4: pm.card?.last4 || '****',
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
  }));

  return NextResponse.json({ paymentMethods });
}
