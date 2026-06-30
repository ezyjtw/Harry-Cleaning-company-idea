import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getClientIp } from '@/lib/rate-limit';
import { RateLimiter } from '@/lib/utils/security';

const leadsRateLimiter = new RateLimiter({
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
    const rateCheck = leadsRateLimiter.check(clientIP);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, postcode, bedrooms, bathrooms, serviceType, estimatedTotal } = body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[LEAD] email=${email.trim()}, postcode=${postcode}, ` +
        `bedrooms=${bedrooms}, bathrooms=${bathrooms}, ` +
        `service=${serviceType}, estimate=£${estimatedTotal}, ip=${clientIP}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Leads API error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
