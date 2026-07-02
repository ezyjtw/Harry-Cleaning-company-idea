import { describe, it, expect } from 'vitest';

import {
  computeCleanerOpenRanges,
  computeOpenRangesForDate,
  expandToSlots,
  timeToMinutes,
  toDateString,
  type TimeRange,
} from './timesheet';

// ─── Independent reference ──────────────────────────────────────────────────
// A faithful, SEPARATE copy of the ORIGINAL per-cleaner route algorithm (before
// the shared-helper refactor). The helper under test is proven against this
// oracle — not against itself — so this locks the behaviour-preserving claim.
// subtract/expand are re-implemented locally so the core logic isn't borrowed
// from the module under test.

function subtractRef(available: TimeRange[], blocked: TimeRange[]): TimeRange[] {
  let result = [...available];
  for (const block of blocked) {
    const next: TimeRange[] = [];
    for (const range of result) {
      if (block.end <= range.start || block.start >= range.end) {
        next.push(range);
      } else {
        if (block.start > range.start) next.push({ start: range.start, end: block.start });
        if (block.end < range.end) next.push({ start: block.end, end: range.end });
      }
    }
    result = next;
  }
  return result;
}

function expandRef(ranges: TimeRange[], durationMins: number): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    let m = r.start;
    while (m + durationMins <= r.end) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
      m += 30;
    }
  }
  return out;
}

interface Fixture {
  targetDate: Date;
  bufferMins: number;
  durationMins: number;
  recurringSlots: { dayOfWeek: number; startTime: string; endTime: string }[];
  dateSlots: { date: Date; startTime: string; endTime: string }[];
  overrides: { date: Date; startTime: string | null; endTime: string | null }[];
  bookings: { date: Date; startTime: string; duration: number }[];
}

/** The ORIGINAL route computation for a single date, reproduced independently. */
function referenceSlots(f: Fixture): string[] {
  const targetStr = toDateString(f.targetDate);
  const dow = f.targetDate.getDay();
  const isPast = targetStr <= toDateString(new Date());

  let fullDayBlocked = false;
  const partial: TimeRange[] = [];
  for (const o of f.overrides) {
    if (toDateString(o.date) !== targetStr) continue;
    if (o.startTime && o.endTime) {
      partial.push({ start: timeToMinutes(o.startTime), end: timeToMinutes(o.endTime) });
    } else {
      fullDayBlocked = true;
    }
  }

  const bookingBlocks: TimeRange[] = [];
  for (const b of f.bookings) {
    if (toDateString(b.date) !== targetStr) continue;
    const s = timeToMinutes(b.startTime);
    const dur = Number(b.duration) * 60;
    bookingBlocks.push({
      start: Math.max(0, s - f.bufferMins),
      end: Math.min(1440, s + dur + f.bufferMins),
    });
  }

  const recurring: TimeRange[] = f.recurringSlots
    .filter((s) => s.dayOfWeek === dow)
    .map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }));
  const ds: TimeRange[] = f.dateSlots
    .filter((s) => toDateString(s.date) === targetStr)
    .map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }));
  const base = ds.length > 0 ? ds : recurring;
  const hasSlots = base.length > 0;

  if (isPast || fullDayBlocked) return [];
  if (!hasSlots) return [];
  return expandRef(subtractRef(base, [...partial, ...bookingBlocks]), f.durationMins);
}

/** Slots via the shared helper (the band/discovery path: raw rows → open ranges → slots). */
function helperSlots(f: Fixture): string[] {
  const { openRanges } = computeCleanerOpenRanges({
    targetDate: f.targetDate,
    bufferMins: f.bufferMins,
    recurringSlots: f.recurringSlots,
    dateSlots: f.dateSlots,
    overrides: f.overrides,
    bookings: f.bookings,
  });
  return expandToSlots(openRanges, f.durationMins);
}

const FUTURE = new Date('2099-06-15T12:00:00'); // definitely future
const PAST = new Date('2000-06-15T12:00:00'); // definitely past
const DOW = FUTURE.getDay();
const OTHER_DATE = new Date('2099-06-16T12:00:00'); // a different date, for filter noise

const RECURRING_9_17 = [{ dayOfWeek: DOW, startTime: '09:00', endTime: '17:00' }];

describe('timesheet shared helper — parity with the original per-cleaner algorithm', () => {
  const cases: { name: string; fixture: Fixture; expected?: string[] }[] = [
    {
      name: 'recurring-only (+ unrelated override on another date is ignored)',
      fixture: {
        targetDate: FUTURE,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: RECURRING_9_17,
        dateSlots: [],
        overrides: [{ date: OTHER_DATE, startTime: null, endTime: null }],
        bookings: [],
      },
      expected: [
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '11:00',
        '11:30',
        '12:00',
        '12:30',
        '13:00',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
      ],
    },
    {
      name: 'date-specific slot takes precedence over recurring',
      fixture: {
        targetDate: FUTURE,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: RECURRING_9_17,
        dateSlots: [{ date: FUTURE, startTime: '13:00', endTime: '16:00' }],
        overrides: [],
        bookings: [],
      },
      expected: ['13:00', '13:30', '14:00'],
    },
    {
      name: 'full-day time-off blocks the whole date',
      fixture: {
        targetDate: FUTURE,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: RECURRING_9_17,
        dateSlots: [],
        overrides: [{ date: FUTURE, startTime: null, endTime: null }],
        bookings: [],
      },
      expected: [],
    },
    {
      name: 'existing booking subtracts (± buffer)',
      fixture: {
        targetDate: FUTURE,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: RECURRING_9_17,
        dateSlots: [],
        overrides: [],
        bookings: [{ date: FUTURE, startTime: '11:00', duration: 2 }], // blocks 10:30–13:30
      },
      expected: ['13:30', '14:00', '14:30', '15:00'],
    },
    {
      name: 'partial-day time-off subtracts a mid-day window',
      fixture: {
        targetDate: FUTURE,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: RECURRING_9_17,
        dateSlots: [],
        overrides: [{ date: FUTURE, startTime: '12:00', endTime: '14:00' }],
        bookings: [],
      },
      expected: ['09:00', '09:30', '10:00', '14:00', '14:30', '15:00'],
    },
    {
      name: 'past date yields nothing',
      fixture: {
        targetDate: PAST,
        bufferMins: 30,
        durationMins: 120,
        recurringSlots: [{ dayOfWeek: PAST.getDay(), startTime: '09:00', endTime: '17:00' }],
        dateSlots: [],
        overrides: [],
        bookings: [],
      },
      expected: [],
    },
  ];

  for (const c of cases) {
    it(`matches the reference — ${c.name}`, () => {
      const ref = referenceSlots(c.fixture);
      const helper = helperSlots(c.fixture);
      // Helper reproduces the original algorithm exactly...
      expect(helper).toEqual(ref);
      // ...and both hit the concrete expected values (guards against a matching bug in both).
      if (c.expected) {
        expect(helper).toEqual(c.expected);
        expect(ref).toEqual(c.expected);
      }
    });
  }
});

describe('computeOpenRangesForDate — the core the per-cleaner route now calls', () => {
  it('date-specific ranges take precedence over recurring', () => {
    const open = computeOpenRangesForDate({
      dateSpecificRanges: [{ start: timeToMinutes('13:00'), end: timeToMinutes('16:00') }],
      recurringRanges: [{ start: timeToMinutes('09:00'), end: timeToMinutes('17:00') }],
      fullDayBlocked: false,
      partialBlocks: [],
      bookingBlocks: [],
      isPast: false,
    });
    expect(open).toEqual([{ start: 780, end: 960 }]); // 13:00–16:00
  });

  it('returns nothing when the day is fully blocked or past', () => {
    const base = {
      dateSpecificRanges: null,
      recurringRanges: [{ start: 540, end: 1020 }],
      partialBlocks: [],
      bookingBlocks: [],
    };
    expect(computeOpenRangesForDate({ ...base, fullDayBlocked: true, isPast: false })).toEqual([]);
    expect(computeOpenRangesForDate({ ...base, fullDayBlocked: false, isPast: true })).toEqual([]);
  });
});
