import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getClientIp } from '@/lib/rate-limit';
import { GdprService } from '@/lib/services/gdpr.service';
import { updatePreferences } from '@/lib/services/notification-preferences.service';
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

    // H65 (James ruling a): the tick means something. This endpoint only fires
    // when the promotional-offers box was TICKED, so persist the lead durably
    // (was console-log only — the "consent" evaporated with the deploy) and
    // write the consent into the real ledger:
    //   1. Lead row — the durable capture (upsert: double submits don't dupe).
    //   2. GdprConsent — the immutable, EMAIL-keyed consent record (guest-safe).
    //   3. If the email has an account, grant the live NotificationPreference
    //      marketing opt-in — the ledger the email chokepoint enforces.
    // Unticked stores nothing (the client never calls this endpoint unticked).
    const cleanEmail = email.trim().toLowerCase();
    const cleanPostcode = typeof postcode === 'string' ? postcode.trim().toUpperCase() : '';
    const now = new Date();
    await prisma.lead.upsert({
      where: { email_postcode: { email: cleanEmail, postcode: cleanPostcode } },
      create: {
        email: cleanEmail,
        postcode: cleanPostcode,
        bedrooms: Number.isFinite(Number(bedrooms)) ? Number(bedrooms) : null,
        bathrooms: Number.isFinite(Number(bathrooms)) ? Number(bathrooms) : null,
        serviceType: typeof serviceType === 'string' ? serviceType : null,
        estimatedTotal: Number.isFinite(Number(estimatedTotal)) ? Number(estimatedTotal) : null,
        marketingConsentAt: now,
      },
      update: { marketingConsentAt: now },
    });

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    await GdprService.recordConsent({
      userId: existingUser?.id,
      email: cleanEmail,
      consentType: 'marketing',
      granted: true,
      ipAddress: clientIP,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch((err) => {
      // PECR evidence — must not vanish silently.
      // eslint-disable-next-line no-console
      console.error('[LEAD] GdprConsent write failed:', err);
    });

    if (existingUser) {
      await updatePreferences(existingUser.id, { marketing: true }).catch(() => {});
    }

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
