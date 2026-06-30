import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { GdprService } from '@/lib/services/gdpr.service';
import { updatePreferences } from '@/lib/services/notification-preferences.service';
import { verifyUnsubscribeToken } from '@/lib/utils/unsubscribe-token';

// A11c: PECR unsubscribe endpoint. No auth — the signed token IS the
// authorisation, so a recipient can opt out straight from an email (one-click,
// RFC 8058) or via the friendly /unsubscribe page. Idempotent: unsubscribing an
// already-unsubscribed user is a no-op success.
//
// Mailbox providers honouring `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
// POST here with the token in the query string; the page also POSTs here.

async function unsubscribe(token: string | null): Promise<NextResponse> {
  if (!token) {
    return NextResponse.json({ error: 'Missing unsubscribe token.' }, { status: 400 });
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link.' }, { status: 400 });
  }

  // Confirm the user still exists (token is stateless and never expires).
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) {
    // Treat as success — there is nothing left to email.
    return NextResponse.json({ ok: true });
  }

  const { marketingChanged } = await updatePreferences(userId, { marketing: false });

  // Append PECR evidence only when this actually changed something.
  if (marketingChanged) {
    await GdprService.recordConsent({
      userId,
      email: user.email,
      consentType: 'marketing',
      granted: false,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        `[Unsubscribe] FAILED to record marketing-consent withdrawal audit for user=${userId}:`,
        err
      );
    });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  return unsubscribe(token);
}

// Some mail clients follow List-Unsubscribe as a plain GET link. Support it too
// so the opt-out always works, then the /unsubscribe page confirms visually.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  return unsubscribe(token);
}
