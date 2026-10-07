// B3 (RENA-027, RENA-032, D-f): the one place that turns a booking's London
// wall clock into a real instant. A booking stores its calendar day as a UTC
// midnight Date (the London day's Y-M-D) and its start as "HH:MM" London wall
// time, or "Flexible". Every helper that needs the start or end of a slot as
// an instant calls this module; no other London to UTC arithmetic remains.
//
// Daylight saving rules (James-ruled 2026-10-07):
//   * Spring gap (the last Sunday of March, 01:00 to 01:59 does not exist):
//     such a time is not a valid booking time. validateBookingSlot rejects it
//     at every creation and move boundary. A read of a legacy row carrying one
//     resolves forward by the gap (01:30 reads as 02:30 BST), so a clock is
//     never lost.
//   * Autumn overlap (the last Sunday of October, 01:00 to 01:59 happens
//     twice): the later occurrence (GMT) is the booking time.
//   * Durations are elapsed time: end = start + duration hours, so a 23:30
//     start with 2 hours ends 01:30 the next London day, and a job spanning a
//     clock change lasts its real length.
//
// Pure (Intl only): safe on the server and in the browser.

const LONDON_TZ = 'Europe/London';
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

let partsFmt: Intl.DateTimeFormat | null = null;
function londonFormatter(): Intl.DateTimeFormat {
  if (!partsFmt) {
    partsFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: LONDON_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return partsFmt;
}

/** London wall clock parts at an instant (month 1 to 12). */
export function londonParts(d: Date): {
  y: number;
  m: number;
  day: number;
  hour: number;
  min: number;
} {
  const parts: Record<string, string> = {};
  for (const p of londonFormatter().formatToParts(d)) parts[p.type] = p.value;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    // "24" can appear for midnight in some ICU versions; normalise to 0.
    hour: Number(parts.hour) % 24,
    min: Number(parts.minute),
  };
}

/** UTC offset of London at the given instant, in ms (0 for GMT, one hour for BST). */
export function londonOffsetMs(d: Date): number {
  const p = londonParts(d);
  const wallAsUtc = Date.UTC(p.y, p.m - 1, p.day, p.hour, p.min);
  const instantMinutes = Math.floor(d.getTime() / MINUTE_MS) * MINUTE_MS;
  return wallAsUtc - instantMinutes;
}

export type WallResolution =
  | { kind: 'exact'; instant: Date }
  | { kind: 'ambiguous'; instant: Date; earlier: Date }
  | { kind: 'nonexistent'; instant: Date };

/**
 * Resolve a London wall clock (month 1 to 12) to an instant. London's offset is
 * 0 or one hour, so the candidates are the wall read as UTC and one hour
 * before it; a candidate is real when London's offset at it matches.
 * Ambiguous walls resolve to the later occurrence; nonexistent walls resolve
 * forward by the gap and are flagged so creation paths can reject them.
 */
export function resolveLondonWall(
  y: number,
  m: number,
  day: number,
  hour: number,
  min: number
): WallResolution {
  const wall = Date.UTC(y, m - 1, day, hour, min);
  const asGmt = new Date(wall);
  const asBst = new Date(wall - HOUR_MS);
  const gmtReal = londonOffsetMs(asGmt) === 0;
  const bstReal = londonOffsetMs(asBst) === HOUR_MS;
  if (gmtReal && bstReal) return { kind: 'ambiguous', instant: asGmt, earlier: asBst };
  if (gmtReal) return { kind: 'exact', instant: asGmt };
  if (bstReal) return { kind: 'exact', instant: asBst };
  // The spring gap: read with the pre-change offset (GMT), which lands the
  // same distance after the jump.
  return { kind: 'nonexistent', instant: asGmt };
}

/** London wall clock to instant, the later occurrence when ambiguous. */
export function londonWallToUtc(
  y: number,
  m: number,
  day: number,
  hour: number,
  min: number
): Date {
  return resolveLondonWall(y, m, day, hour, min).instant;
}

export function parseStartTime(
  startTime: string | null | undefined
): { h: number; m: number } | null {
  if (typeof startTime !== 'string') return null;
  const match = TIME_RE.exec(startTime.trim());
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** True for "Flexible" or any value that is not a clock. */
export function isFlexibleStart(startTime: string | null | undefined): boolean {
  return parseStartTime(startTime) === null;
}

function dayParts(date: Date): { y: number; m: number; day: number } {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** The stored booking day for "YYYY-MM-DD": UTC midnight of that calendar day. */
export function bookingDayFromIso(iso: string): Date | null {
  const match = DATE_RE.exec(iso);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (d.toISOString().slice(0, 10) !== iso) return null;
  return d;
}

/** Midnight London at the start of the booking's day, as an instant. */
export function londonDayStartUtc(date: Date): Date {
  const { y, m, day } = dayParts(date);
  return londonWallToUtc(y, m, day, 0, 0);
}

/** One millisecond before the next London midnight. */
export function londonDayEndUtc(date: Date): Date {
  const { y, m, day } = dayParts(date);
  const next = new Date(Date.UTC(y, m - 1, day + 1));
  return new Date(londonDayStartUtc(next).getTime() - 1);
}

/** A wall clock on the booking's London day, as an instant. */
export function londonTimeOnDayUtc(date: Date, hour: number, min: number): Date {
  const { y, m, day } = dayParts(date);
  return londonWallToUtc(y, m, day, hour, min);
}

/** Scheduled start as an instant; null for Flexible or unparsable times. */
export function bookingStartUtc(date: Date, startTime: string | null | undefined): Date | null {
  const t = parseStartTime(startTime);
  if (!t) return null;
  return londonTimeOnDayUtc(date, t.h, t.m);
}

/** Scheduled end as an instant (start plus elapsed duration); null when Flexible. */
export function bookingEndUtc(
  date: Date,
  startTime: string | null | undefined,
  durationHours: number
): Date | null {
  const start = bookingStartUtc(date, startTime);
  if (!start) return null;
  return new Date(start.getTime() + Number(durationHours) * HOUR_MS);
}

/**
 * Start for clocks that must always have a value: a Flexible booking counts
 * from London midnight of its day (the loud reading for overdue and money
 * blocking checks, as before).
 */
export function bookingStartOrDayStartUtc(date: Date, startTime: string | null | undefined): Date {
  return bookingStartUtc(date, startTime) ?? londonDayStartUtc(date);
}

export function bookingEndOrDayEndUtc(
  date: Date,
  startTime: string | null | undefined,
  durationHours: number
): Date {
  return new Date(
    bookingStartOrDayStartUtc(date, startTime).getTime() + Number(durationHours) * HOUR_MS
  );
}

export type SlotValidation =
  | { ok: true; day: Date; start: Date | null }
  | { ok: false; reason: 'INVALID_DATE' | 'INVALID_TIME' | 'NONEXISTENT_TIME' };

/**
 * The creation and move boundary: a real calendar day, a real clock (or
 * Flexible when allowed), and never a time inside the spring gap.
 */
export function validateBookingSlot(
  isoDate: string,
  startTime: string,
  opts: { allowFlexible?: boolean } = {}
): SlotValidation {
  const day = bookingDayFromIso(isoDate);
  if (!day) return { ok: false, reason: 'INVALID_DATE' };
  const t = parseStartTime(startTime);
  if (!t) {
    if (opts.allowFlexible && startTime === 'Flexible') return { ok: true, day, start: null };
    return { ok: false, reason: 'INVALID_TIME' };
  }
  const { y, m, day: d } = dayParts(day);
  const r = resolveLondonWall(y, m, d, t.h, t.m);
  if (r.kind === 'nonexistent') return { ok: false, reason: 'NONEXISTENT_TIME' };
  return { ok: true, day, start: r.instant };
}

export const NONEXISTENT_TIME_MESSAGE =
  "That time doesn't exist on this date because the clocks go forward. Pick another time.";

// ─── D-f lifecycle windows (RENA-027, RENA-032; James-ruled) ─────────────

export const EN_ROUTE_LEAD_MS = 2 * HOUR_MS;
export const IN_PROGRESS_LEAD_MS = 30 * MINUTE_MS;
export const COMPLETE_BEFORE_END_MS = 30 * MINUTE_MS;
/** Flexible jobs may start moving from 06:00 London on the booking day. */
export const FLEXIBLE_OPEN_HOUR = 6;

export type WindowTarget = 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type WindowResult =
  | { allowed: true; opensAt: Date | null }
  | { allowed: false; opensAt: Date; code: 'TOO_EARLY' }
  | { allowed: false; opensAt: null; code: 'NEEDS_START' };

/**
 * Fixed time: EN_ROUTE from start minus 2h, IN_PROGRESS from start minus 30m,
 * COMPLETED from end minus 30m. Flexible: EN_ROUTE and IN_PROGRESS from 06:00
 * London on the day; COMPLETED only after IN_PROGRESS, from checkedInAt plus
 * duration minus 30m. CANCELLED has no window.
 */
export function transitionWindow(
  target: WindowTarget,
  booking: {
    date: Date;
    startTime: string;
    duration: number | string | { toString(): string };
    checkedInAt?: Date | null;
  },
  now: Date
): WindowResult {
  if (target === 'CANCELLED') return { allowed: true, opensAt: null };
  const durationHours = Number(booking.duration);
  const start = bookingStartUtc(booking.date, booking.startTime);

  let opensAt: Date;
  if (start) {
    if (target === 'EN_ROUTE') opensAt = new Date(start.getTime() - EN_ROUTE_LEAD_MS);
    else if (target === 'IN_PROGRESS') opensAt = new Date(start.getTime() - IN_PROGRESS_LEAD_MS);
    else opensAt = new Date(start.getTime() + durationHours * HOUR_MS - COMPLETE_BEFORE_END_MS);
  } else if (target === 'COMPLETED') {
    if (!booking.checkedInAt) return { allowed: false, opensAt: null, code: 'NEEDS_START' };
    opensAt = new Date(
      booking.checkedInAt.getTime() + durationHours * HOUR_MS - COMPLETE_BEFORE_END_MS
    );
  } else {
    opensAt = londonTimeOnDayUtc(booking.date, FLEXIBLE_OPEN_HOUR, 0);
  }

  if (now.getTime() < opensAt.getTime()) return { allowed: false, opensAt, code: 'TOO_EARLY' };
  return { allowed: true, opensAt };
}

/** "14:30 on Tuesday 7 October" in London time, for refusals the cleaner reads. */
export function formatLondonClock(d: Date): string {
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = d.toLocaleDateString('en-GB', {
    timeZone: LONDON_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${time} on ${date}`;
}
