import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SALT_ROUNDS = 12;

// F6: the settings form has posted here forever — the route never existed (405).
// POST { currentPassword, newPassword }: verifies the current password, applies
// the same policy as signup, sets the new hash, and stamps passwordChangedAt —
// which invalidates every OTHER session/token (getSessionUser and
// verifyBearerToken reject anything issued before that moment; NextAuth JWT
// sessions cannot be revoked directly, so this DB-check is the enforcement).
// The CURRENT session stays signed in via a fresh sign-in from the client.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`change-password:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts — please try again in a few minutes.' },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in again to change your password.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Both your current and new passwords are required.' },
      { status: 400 }
    );
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return NextResponse.json({ error: policy.errors[0] }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser?.passwordHash) {
    return NextResponse.json(
      { error: 'This account has no password set — use the password reset flow instead.' },
      { status: 400 }
    );
  }

  const matches = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!matches) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'Your new password must be different from your current one.' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  await AuditService.log({
    userId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user.id,
    metadata: { action: 'PASSWORD_CHANGED' },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message: 'Password changed. Other devices have been signed out.',
  });
}
