import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getClientIp } from '@/lib/rate-limit';
import { RateLimiter } from '@/lib/utils/security';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

// F-A: known capture points; anything else is stored as 'unknown' rather than
// trusting arbitrary client strings into the admin table.
const VALID_SOURCES = new Set(['quote-widget', 'service-page']);

const waitlistRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Delegates to the shared, topology-aware resolver. See src/lib/rate-limit.ts.
function getClientIP(request: NextRequest): string {
  return getClientIp(request);
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateCheck = waitlistRateLimiter.check(clientIP);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, postcode, source } = body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!postcode || typeof postcode !== 'string') {
      return NextResponse.json({ error: 'Postcode is required.' }, { status: 400 });
    }

    // F-A: persist (was console-log only — entries were unreachable). Upsert on
    // (email, postcode) so double submits don't duplicate rows.
    const cleanEmail = email.trim().toLowerCase();
    const cleanPostcode = normalizeUkPostcode(postcode) ?? postcode.trim().toUpperCase();
    const cleanSource =
      typeof source === 'string' && VALID_SOURCES.has(source) ? source : 'unknown';
    await prisma.waitlistEntry.upsert({
      where: { email_postcode: { email: cleanEmail, postcode: cleanPostcode } },
      create: { email: cleanEmail, postcode: cleanPostcode, source: cleanSource },
      update: { source: cleanSource },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Waitlist API error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
