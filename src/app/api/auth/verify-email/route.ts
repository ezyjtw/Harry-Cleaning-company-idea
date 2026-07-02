import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { verifyEmail } from '@/lib/services/auth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A16b-2a: one-click email verification. The emailed link points here; we consume
// the token, set emailVerified, and redirect to the friendly /verify-email page
// with a status. GET is intentional (one-click from an email); verifyEmail is
// idempotent + prefetch-safe so re-hits resolve to `already_verified`, not an error.
//
// Relative-Location 303: behind Railway's proxy `request.url` can resolve to an
// internal localhost origin, so we redirect with a relative path (the browser
// resolves it against the public URL it navigated to).
function redirectToStatus(status: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/verify-email?status=${status}` },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return redirectToStatus('invalid');

  const status = await verifyEmail(token);
  return redirectToStatus(status);
}
