// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subscription } = await request.json();
  if (!subscription) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 400 });
  }

  await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      subscription: JSON.stringify(subscription),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
  }

  // Find and delete matching subscription by endpoint
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });

  for (const sub of subscriptions) {
    const parsed = JSON.parse(sub.subscription);
    if (parsed.endpoint === endpoint) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } });
      break;
    }
  }

  return NextResponse.json({ success: true });
}
