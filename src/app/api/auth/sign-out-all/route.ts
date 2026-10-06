import { NextResponse } from 'next/server';

import { revokeAllSessions } from '@/lib/auth/device-session';
import { getSessionUser } from '@/lib/auth/session';
import { AuditService } from '@/lib/services/audit.service';

// RENA-007 (D-g, James-ruled): sign out everywhere. Bumps the user's
// sessionVersion and revokes every DeviceSession row, the current device
// included. Cookie or Bearer authenticated; the caller then completes its own
// sign-out (NextAuth signOut on the web, the shell's /login watch in-app).
// The response also expires the session cookie names so a browser caller is
// signed out even if its signOut call never runs.
const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  '__Secure-next-auth.session-token.0',
  '__Secure-next-auth.session-token.1',
  'next-auth.session-token',
  'next-auth.session-token.0',
  'next-auth.session-token.1',
];

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  }
  const result = await revokeAllSessions(user.id, 'all');
  await AuditService.log({
    userId: user.id,
    action: 'SIGN_OUT_EVERYWHERE',
    entityType: 'User',
    entityId: user.id,
    metadata: { revoked: result.revoked, sessionVersion: result.sessionVersion },
  }).catch(() => {});

  const res = NextResponse.json({ success: true, revoked: result.revoked });
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, '', {
      httpOnly: true,
      secure: name.startsWith('__Secure-'),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
