import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// H6 companion: does this email address already have a Rena account? Powers the
// guest checkout's non-blocking "sign in and this booking will link
// automatically" notice (same predicate as the guest-confirmation email's
// account-aware footer).
//
// Enumeration note: this discloses account existence, which the signup route
// already does ("email already registered"). The rate limit below keeps it
// useless for bulk probing while allowing the checkout's one-or-two calls.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`check-email:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts — please try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, isDeleted: false },
    select: { id: true },
  });

  return NextResponse.json({ hasAccount: !!existing });
}
