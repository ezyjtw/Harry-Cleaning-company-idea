import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { getClientIp } from '@/lib/rate-limit';
import { GdprService } from '@/lib/services/gdpr.service';
import {
  getEffectivePreferences,
  updatePreferences,
  type PreferencePatch,
} from '@/lib/services/notification-preferences.service';

// A11b: user-scoped notification preferences for the /account/notifications and
// /cleaner/notifications pages. Preferences are per-user (role-agnostic), so the
// same endpoint serves both. Essential transactional notifications are NOT
// representable here — they have no toggle and can never be disabled.

// GET /api/account/notification-preferences
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const preferences = await getEffectivePreferences(user.id);
  return NextResponse.json({ preferences });
}

const TOGGLE_KEYS = ['reminders', 'newMessage', 'push', 'sms', 'marketing'] as const;

// PUT /api/account/notification-preferences
export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Accept only the known toggle keys, and only booleans. Unknown keys are
  // ignored; a non-boolean value is a 400 (don't silently coerce).
  const patch: PreferencePatch = {};
  for (const key of TOGGLE_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: `"${key}" must be a boolean.` }, { status: 400 });
    }
    patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields provided.' }, { status: 400 });
  }

  const { preferences, marketingChanged } = await updatePreferences(user.id, patch);

  // PECR/GDPR: append a consent audit row whenever the marketing decision changes.
  // The NotificationPreference row is the live state; GdprConsent is the immutable log.
  if (marketingChanged && patch.marketing !== undefined) {
    await GdprService.recordConsent({
      userId: user.id,
      email: user.email,
      consentType: 'marketing',
      granted: patch.marketing,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch((err) => {
      // Audit logging must never break the preference save (best-effort) — but a
      // failed MARKETING-consent write is the one audit we must not lose silently
      // (PECR evidence). Log loudly so it's recoverable from logs.
      // eslint-disable-next-line no-console
      console.error(
        `[NotificationPreferences] FAILED to record marketing consent audit for user=${user.id} granted=${patch.marketing}:`,
        err
      );
    });
  }

  return NextResponse.json({ preferences });
}
