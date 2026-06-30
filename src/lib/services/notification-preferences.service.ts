import type { NotificationPreference, NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

// ─── A11: Notification preference gate ──────────────────────────────────────
//
// SINGLE CHOKEPOINT for "is this user willing to receive this?". Every email,
// push, and SMS send consults shouldSend() before dispatching — mirroring the
// gated sendMessage pattern. The rules:
//
//   • ESSENTIAL  — transactional/security (booking & payment confirms, receipts,
//                  password reset, email verification). ALWAYS sent. Cannot be
//                  disabled and never even reads the preference row.
//   • REMINDER   — booking reminders + review requests. Toggleable, default ON.
//   • NEW_MESSAGE— new-message alerts. Toggleable, default ON.
//   • MARKETING  — promos/nudges. OPT-IN: sent only with explicit, un-revoked
//                  consent (PECR). No row / no user ⇒ no consent ⇒ suppressed.
//
// IN_APP is intrinsic (the bell) and always delivered. PUSH/SMS additionally
// honour their channel master switch for non-essential categories.

export type NotificationCategory = 'ESSENTIAL' | 'REMINDER' | 'NEW_MESSAGE' | 'MARKETING';
export type DeliveryChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';

// Safe defaults applied when a user has no preference row yet (existing users
// after the additive migration, or brand-new accounts). Must match the column
// defaults in schema.prisma: toggleable ON, marketing OFF.
export const DEFAULT_PREFERENCES = {
  reminders: true,
  newMessage: true,
  push: true,
  sms: true,
  marketing: false,
} as const;

/**
 * Map a NotificationType to its default category. Conservative: anything not
 * explicitly a reminder/message/marketing is treated as ESSENTIAL so important
 * transactional messages are never accidentally suppressed. Callers that send a
 * reminder/marketing using a shared type (e.g. a reminder tagged BOOKING_REQUEST)
 * should pass an explicit category instead of relying on this map.
 */
export function categoryForType(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'NEW_MESSAGE':
      return 'NEW_MESSAGE';
    case 'NEW_REVIEW':
      return 'REMINDER';
    default:
      return 'ESSENTIAL';
  }
}

/** The live preference row for a user, or null if none exists yet. */
export async function getPreferences(userId: string): Promise<NotificationPreference | null> {
  return prisma.notificationPreference.findUnique({ where: { userId } });
}

/**
 * The effective preferences for a user — the stored row merged over safe
 * defaults. Useful for the (future) preferences UI; shouldSend() applies the
 * same defaults inline.
 */
export async function getEffectivePreferences(userId: string) {
  const row = await getPreferences(userId);
  return {
    reminders: row?.reminders ?? DEFAULT_PREFERENCES.reminders,
    newMessage: row?.newMessage ?? DEFAULT_PREFERENCES.newMessage,
    push: row?.push ?? DEFAULT_PREFERENCES.push,
    sms: row?.sms ?? DEFAULT_PREFERENCES.sms,
    marketing: row?.marketing ?? DEFAULT_PREFERENCES.marketing,
    marketingConsentAt: row?.marketingConsentAt ?? null,
    unsubscribedAt: row?.unsubscribedAt ?? null,
  };
}

/**
 * THE gate. Returns true if a message of `category` may be delivered to `userId`
 * over `channel`. Fail-safe by design:
 *   - ESSENTIAL and IN_APP short-circuit to true without touching the DB.
 *   - MARKETING requires an explicit, un-revoked opt-in (no row ⇒ false).
 *   - Toggleable categories default ON when no row exists.
 *
 * `userId` may be null for guest/by-email sends — only meaningful for MARKETING,
 * which then has no consent on record and is correctly suppressed.
 */
export async function shouldSend(
  userId: string | null,
  category: NotificationCategory,
  channel: DeliveryChannel
): Promise<boolean> {
  // In-app (the notification bell) is intrinsic and always delivered.
  if (channel === 'IN_APP') return true;

  // Essential transactional/security messages can never be disabled.
  if (category === 'ESSENTIAL') return true;

  const prefs = userId ? await getPreferences(userId) : null;

  // Marketing is strictly opt-in. No user / no row / no consent / withdrawn ⇒ no.
  if (category === 'MARKETING') {
    if (!prefs) return false;
    return prefs.marketing && !prefs.unsubscribedAt;
  }

  // Channel master switches (only when a row exists; absent ⇒ default ON).
  if (channel === 'PUSH' && prefs && !prefs.push) return false;
  if (channel === 'SMS' && prefs && !prefs.sms) return false;

  // Category-level toggle (default ON when no row exists).
  switch (category) {
    case 'REMINDER':
      return prefs ? prefs.reminders : DEFAULT_PREFERENCES.reminders;
    case 'NEW_MESSAGE':
      return prefs ? prefs.newMessage : DEFAULT_PREFERENCES.newMessage;
    default:
      return true;
  }
}
