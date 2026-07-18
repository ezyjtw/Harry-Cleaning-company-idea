// ─────────────────────────────────────────────────────────────
// B8: quiet hours for non-critical sends — nothing lands on a phone between
// 21:00 and 08:00 London time. All schedule arithmetic elsewhere runs in
// server-local time (UTC on Railway), which is why a "same-day reminder" could
// fire at 1 AM: no timezone conversion existed anywhere. This module is the
// single place that knows about Europe/London (DST included, via Intl).
//
// Critical/immediate emails are exempt and never pass through here: booking
// confirmations, payment failures, refunds, cancellations, cascade/rescue
// offer notifications, security emails (password reset). Those are event-
// driven responses the recipient is actively waiting on.
// ─────────────────────────────────────────────────────────────

const LONDON_TZ = 'Europe/London';

export const QUIET_START_HOUR = 21; // 21:00 London — last acceptable send is 20:59
export const MORNING_HOUR = 8; // deferred sends land at 08:00 London

function londonParts(d: Date): { y: number; m: number; day: number; hour: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    // "24" can appear for midnight in some ICU versions — normalise to 0.
    hour: Number(parts.hour) % 24,
    min: Number(parts.minute),
  };
}

/** UTC offset of London at the given instant, in ms (0 for GMT, +1h for BST). */
function londonOffsetMs(d: Date): number {
  const p = londonParts(d);
  const wallAsUtc = Date.UTC(p.y, p.m - 1, p.day, p.hour, p.min);
  const instantMinutes = Math.floor(d.getTime() / 60000) * 60000;
  return wallAsUtc - instantMinutes;
}

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
  // 08:00 London wall time on the right day, first assuming London == UTC…
  const target = new Date(Date.UTC(p.y, p.m - 1, p.day, MORNING_HOUR, 0, 0));
  if (p.hour >= QUIET_START_HOUR) target.setUTCDate(target.getUTCDate() + 1);
  // …then corrected by the real offset on that morning.
  return new Date(target.getTime() - londonOffsetMs(target));
}
