import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendCleanerWelcome } from '@/lib/services/email.service';
import { displayName } from '@/lib/utils/name';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';
import { isValidPhone } from '@/lib/validation/inputs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

/**
 * H99 ①: cleaner ACCOUNT CREATION at wizard step 0 (email+password step).
 * Creates the User (role CLEANER, no profile yet) and sends the
 * welcome-framed verify email — so wizard abandoners remain contactable and
 * the verification lifecycle starts at the real account moment, not at
 * wizard completion. The CleanerProfile arrives later via /api/cleaners POST
 * (final submit), which attaches to this account under session proof.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Same tightness as the final-submit cleaner-signup limit: this endpoint
  // now creates DB rows at step 0, so it carries its own 3/hour guard.
  const rl = checkRateLimit(`cleaner-signup-start:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const email = body.email?.toLowerCase().trim();
  const phone = body.phone?.trim();
  const password = body.password;

  if (!firstName || !lastName || !email || !phone || !password) {
    return NextResponse.json(
      { error: 'Name, email, phone and password are required.' },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
  }
  const pw = validatePasswordPolicy(password);
  if (!pw.valid) {
    return NextResponse.json({ error: pw.errors[0] }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, cleanerProfile: { select: { id: true } } },
  });
  if (existing) {
    // Friendly duplicate handling — the wizard renders this inline with a
    // log-in link. Same disclosure level the final submit has always had.
    const error = existing.cleanerProfile
      ? 'A cleaner account with this email already exists. Log in to continue.'
      : existing.role === 'CLEANER'
        ? 'You already started an application with this email. Log in to continue where you left off.'
        : 'You already have a Rena account with this email. Log in to continue — your details carry over.';
    return NextResponse.json({ error, code: 'account_exists' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: displayName(`${firstName} ${lastName}`),
      phone,
      role: 'CLEANER',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  // H99 ①: welcome-verify — loud both ways, per the logging law. The send is
  // fire-and-forget (never blocks step 0) but NEVER silent.
  const token = crypto.randomBytes(32).toString('hex');
  try {
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });
    sendCleanerWelcome(email, token, firstName)
      .then((ok) => {
        // eslint-disable-next-line no-console
        console.log(
          `[CleanerSignup] Welcome-verify ${ok ? 'queued' : 'FAILED (send returned false)'} for ${email}`
        );
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(`[CleanerSignup] Welcome-verify FAILED for ${email}:`, e);
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[CleanerSignup] Welcome-verify token mint FAILED for ${email}:`, e);
  }

  return NextResponse.json({ ok: true, userId: user.id });
}
