// ─── Cleaner timesheet → bookable availability (SINGLE SOURCE OF TRUTH) ──────
//
// The one place that turns a cleaner's published timesheet into open, bookable
// time on a given date. Used by BOTH:
//   • the per-cleaner calendar  (/api/cleaners/[id]/availability)
//   • the time-first discovery  (availability-query.service → /api/cleaners/available)
// so the two can never diverge.
//
// Timesheet precedence (matches the per-cleaner calendar exactly):
//   base ranges = date-specific slots (AvailabilityDateSlot) IF any for that date,
//                 ELSE the recurring weekly template (AvailabilitySlot for the DOW)
//   minus full-day / partial time-off (AvailabilityOverride)
//   minus existing bookings (± the cleaner's booking buffer)
//   = open ranges → expand to 30-min bookable starts that fit the requested duration.

export interface TimeRange {
  start: number; // minutes from midnight
  end: number;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Remove blocked ranges from available ranges. */
export function subtractRanges(available: TimeRange[], blocked: TimeRange[]): TimeRange[] {
  let result = [...available];
  for (const block of blocked) {
    const next: TimeRange[] = [];
    for (const range of result) {
      if (block.end <= range.start || block.start >= range.end) {
        next.push(range);
      } else {
        if (block.start > range.start) {
          next.push({ start: range.start, end: block.start });
        }
        if (block.end < range.end) {
          next.push({ start: block.end, end: range.end });
        }
      }
    }
    result = next;
  }
  return result;
}

/** Bookable 30-min start times (as "HH:MM") where a `durationMins` job fits. */
export function expandToSlots(ranges: TimeRange[], durationMins: number, stepMins = 30): string[] {
  const slots: string[] = [];
  for (const range of ranges) {
    let mins = range.start;
    while (mins + durationMins <= range.end) {
      slots.push(minutesToTime(mins));
      mins += stepMins;
    }
  }
  return slots;
}

// ─── Core: open ranges for a single date (the precedence + subtraction logic) ──

export interface OpenRangesParams {
  /** Date-specific slots for this date (takes precedence), or null if none. */
  dateSpecificRanges: TimeRange[] | null;
  /** Recurring weekly ranges for this date's day-of-week. */
  recurringRanges: TimeRange[];
  /** A full-day time-off override exists for this date. */
  fullDayBlocked: boolean;
  /** Partial-day time-off blocks for this date. */
  partialBlocks: TimeRange[];
  /** Existing booking blocks (already expanded by buffer) for this date. */
  bookingBlocks: TimeRange[];
  /** This date is today or earlier. */
  isPast: boolean;
}

export function computeOpenRangesForDate(p: OpenRangesParams): TimeRange[] {
  if (p.isPast || p.fullDayBlocked) return [];
  const baseRanges = p.dateSpecificRanges ?? p.recurringRanges;
  if (baseRanges.length === 0) return [];
  return subtractRanges(baseRanges, [...p.partialBlocks, ...p.bookingBlocks]);
}

// ─── Convenience: raw timesheet rows → open ranges for one cleaner on one date ──
// Used by the cross-cleaner time-first query. The per-cleaner calendar builds the
// same inputs from its own bulk-grouped maps and calls computeOpenRangesForDate
// directly — both funnel through the identical core above.

export interface CleanerDayInput {
  targetDate: Date;
  bufferMins: number;
  recurringSlots: { dayOfWeek: number; startTime: string; endTime: string }[];
  dateSlots: { date: Date; startTime: string; endTime: string }[]; // any dates; filtered to targetDate
  overrides: { date: Date; startTime: string | null; endTime: string | null }[]; // blocked; filtered
  bookings: { date: Date; startTime: string; duration: number }[]; // any dates; filtered to targetDate
  isPast?: boolean; // defaults to (targetDate <= today)
}

export interface CleanerDayAvailability {
  openRanges: TimeRange[];
  hasBaseSlots: boolean; // cleaner publishes availability for this date (before blocks)
  fullDayBlocked: boolean;
}

export function computeCleanerOpenRanges(input: CleanerDayInput): CleanerDayAvailability {
  const targetStr = toDateString(input.targetDate);
  const dayOfWeek = input.targetDate.getDay();
  const isPast = input.isPast ?? targetStr <= toDateString(new Date());

  // Recurring ranges for this DOW.
  const recurringRanges: TimeRange[] = input.recurringSlots
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }));

  // Date-specific ranges (precedence over recurring when present).
  const dateSpecific = input.dateSlots
    .filter((ds) => toDateString(ds.date) === targetStr)
    .map((ds) => ({ start: timeToMinutes(ds.startTime), end: timeToMinutes(ds.endTime) }));
  const dateSpecificRanges = dateSpecific.length > 0 ? dateSpecific : null;

  // Overrides: full-day (no times) vs partial-day.
  let fullDayBlocked = false;
  const partialBlocks: TimeRange[] = [];
  for (const o of input.overrides) {
    if (toDateString(o.date) !== targetStr) continue;
    if (o.startTime && o.endTime) {
      partialBlocks.push({ start: timeToMinutes(o.startTime), end: timeToMinutes(o.endTime) });
    } else {
      fullDayBlocked = true;
    }
  }

  // Booking blocks (± buffer), same as the per-cleaner calendar.
  const bookingBlocks: TimeRange[] = [];
  for (const b of input.bookings) {
    if (toDateString(b.date) !== targetStr) continue;
    const startMins = timeToMinutes(b.startTime);
    const durMins = Number(b.duration) * 60;
    bookingBlocks.push({
      start: Math.max(0, startMins - input.bufferMins),
      end: Math.min(1440, startMins + durMins + input.bufferMins),
    });
  }

  const openRanges = computeOpenRangesForDate({
    dateSpecificRanges,
    recurringRanges,
    fullDayBlocked,
    partialBlocks,
    bookingBlocks,
    isPast,
  });

  const hasBaseSlots = (dateSpecificRanges ?? recurringRanges).length > 0;
  return { openRanges, hasBaseSlots, fullDayBlocked };
}
