import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { resendEmailVerification } from '@/lib/services/auth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A16b-2a: resend an email-verification link. Enumeration-safe — always returns a
// generic success regardless of whether the email matches an unverified account.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`resend-verification:${ip}`, 3, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  await resendEmailVerification(email);

  // Generic response — never reveal whether the account exists / is verified.
  return NextResponse.json({
    ok: true,
    message: "If an unverified account exists for that email, we've sent a new verification link.",
  });
}
