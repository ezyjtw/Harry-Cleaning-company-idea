import crypto from 'crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { sendCleanerWelcome } from '@/lib/services/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same expiry as the step-0 send in /api/cleaners/signup-start.
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

/**
 * F28: admin re-sends the welcome-verify email to an INCOMPLETE cleaner
 * signup (role CLEANER, no profile — the same structural guard as the H106
 * broom). Sends the CLEANER welcome framing, not the generic verify email,
 * so the resend reads like the original the wizard promised them.
 */
export async function POST(_request: NextRequest, context: { params: { id: string } }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: context.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isDeleted: true,
      emailVerified: true,
      cleanerProfile: { select: { id: true } },
    },
  });
  if (!user || user.isDeleted) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (user.role !== 'CLEANER' || user.cleanerProfile) {
    return NextResponse.json(
      { error: 'Only incomplete cleaner signups can be resent from here.' },
      { status: 400 }
    );
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: 'This email is already verified.' }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  const firstName = user.name?.split(/\s+/)[0] || 'there';
  const sent = await sendCleanerWelcome(user.email, token, firstName);
  if (!sent) {
    return NextResponse.json(
      { error: 'The email provider refused the send — try again shortly.' },
      { status: 502 }
    );
  }

  await AuditService.log({
    userId: admin.id,
    action: 'ADMIN_RESEND_VERIFICATION',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email },
  });

  return NextResponse.json({ ok: true });
}
