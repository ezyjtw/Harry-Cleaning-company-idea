// ─────────────────────────────────────────────────────────────
// B8: quiet hours for non-critical sends — nothing lands on a phone between
// 21:00 and 08:00 London time. All schedule arithmetic elsewhere runs in
// server-local time (UTC on Railway), which is why a "same-day reminder" could
// fire at 1 AM: no timezone conversion existed anywhere. This module is the
// quiet-hours rule; the London clock itself lives in src/lib/time/booking-time.ts.
//
// Critical/immediate emails are exempt and never pass through here: booking
// confirmations, payment failures, refunds, cancellations, cascade/rescue
// offer notifications, security emails (password reset). Those are event-
// driven responses the recipient is actively waiting on.
// ─────────────────────────────────────────────────────────────

import { londonParts, londonWallToUtc } from '@/lib/time/booking-time';

const LONDON_TZ = 'Europe/London';

export const QUIET_START_HOUR = 21; // 21:00 London — last acceptable send is 20:59
export const MORNING_HOUR = 8; // deferred sends land at 08:00 London

export function isQuietHoursLondon(d: Date): boolean {
  const { hour } = londonParts(d);
  return hour >= QUIET_START_HOUR || hour < MORNING_HOUR;
}

/**
 * If `d` falls inside quiet hours (21:00–08:00 London), return the next
 * 08:00 London as a UTC instant; otherwise return `d` unchanged.
 * DST-safe: the offset is taken at the target morning, and the 01:00 London
 * DST switchover can never coincide with an 08:00 target.
 */
export function deferToMorningLondon(d: Date): Date {
  const p = londonParts(d);
  if (p.hour >= MORNING_HOUR && p.hour < QUIET_START_HOUR) return d;
  // B3: 08:00 London on the right day through the one London helper.
  const day = new Date(Date.UTC(p.y, p.m - 1, p.day + (p.hour >= QUIET_START_HOUR ? 1 : 0)));
  return londonWallToUtc(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
    MORNING_HOUR,
    0
  );
}

/**
 * NOTIFICATION COPY PACK (James-ruled, 11 Sep): a stated day must be provably
 * true AT DELIVERY — quiet-hours deferral means a "12h before" send often
 * lands morning-of, so static "tomorrow" copy was frequently a lie. Compares
 * the booking's calendar date (stored as a UTC-midnight date) against the
 * send moment's London date: "Today", "Tomorrow", or — for sends delayed
 * further out (outage replays) — the honest weekday name.
 */
export function londonDayWord(bookingDate: Date, now: Date): string {
  const iso = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const target = iso(bookingDate, 'UTC');
  if (target === iso(now, LONDON_TZ)) return 'Today';
  if (target === iso(new Date(now.getTime() + 24 * 3600_000), LONDON_TZ)) return 'Tomorrow';
  return bookingDate.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}
