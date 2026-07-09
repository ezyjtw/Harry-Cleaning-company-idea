// Called by the RENA Cleaners shell / external flows — no web importers by design. Do not flag as dead.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// POST /api/push/expo/register  { expoPushToken, platform }
// Registers (or refreshes) a Rena Pro device token for the authenticated user.
// Auth: NextAuth cookie OR Bearer (the shell sends the Keychain Bearer).
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const expoPushToken = typeof body?.expoPushToken === 'string' ? body.expoPushToken.trim() : '';
  const platform = body?.platform === 'android' ? 'android' : 'ios';

  // Expo tokens look like ExponentPushToken[xxx] or ExpoPushToken[xxx].
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(expoPushToken)) {
    return NextResponse.json({ error: 'Invalid Expo push token.' }, { status: 400 });
  }

  // Upsert on the token: if it moved to a new user (device re-login), re-own it.
  await prisma.deviceToken.upsert({
    where: { expoPushToken },
    create: { userId: user.id, expoPushToken, platform },
    update: { userId: user.id, platform, lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
