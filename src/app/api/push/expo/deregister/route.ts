import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// POST /api/push/expo/deregister  { expoPushToken }
// Removes a device token on logout. Only deletes tokens owned by the caller.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const expoPushToken = typeof body?.expoPushToken === 'string' ? body.expoPushToken.trim() : '';
  if (!expoPushToken) {
    return NextResponse.json({ error: 'expoPushToken is required' }, { status: 400 });
  }

  await prisma.deviceToken.deleteMany({ where: { expoPushToken, userId: user.id } });

  return NextResponse.json({ ok: true });
}
