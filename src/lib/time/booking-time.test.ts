import { describe, expect, it } from 'vitest';

import {
  bookingDayFromIso,
  bookingEndOrDayEndUtc,
  bookingEndUtc,
  bookingStartUtc,
  formatLondonClock,
  londonDayEndUtc,
  londonDayStartUtc,
  resolveLondonWall,
  transitionWindow,
  validateBookingSlot,
} from './booking-time';

// B3 (RENA-027, RENA-032, D-f): the London clock and the lifecycle windows.
const day = (iso: string) => bookingDayFromIso(iso) as Date;
const at = (iso: string) => new Date(iso);
const MIN = 60 * 1000;

describe('bookingStartUtc', () => {
  it('winter (GMT): wall equals UTC', () => {
    expect(bookingStartUtc(day('2026-01-15'), '14:00')?.toISOString()).toBe(
      '2026-01-15T14:00:00.000Z'
    );
  });

  it('summer (BST): wall is one hour ahead of UTC', () => {
    expect(bookingStartUtc(day('2026-07-15'), '14:00')?.toISOString()).toBe(
      '2026-07-15T13:00:00.000Z'
    );
  });

  it('Flexible and junk are null', () => {
    expect(bookingStartUtc(day('2026-07-15'), 'Flexible')).toBeNull();
    expect(bookingStartUtc(day('2026-07-15'), '25:00')).toBeNull();
    expect(bookingStartUtc(day('2026-07-15'), '')).toBeNull();
  });

  it('spring change day 2026-03-29: before and after the jump', () => {
    expect(bookingStartUtc(day('2026-03-29'), '00:30')?.toISOString()).toBe(
      '2026-03-29T00:30:00.000Z'
    );
    expect(bookingStartUtc(day('2026-03-29'), '09:00')?.toISOString()).toBe(
      '2026-03-29T08:00:00.000Z'
    );
  });

  it('spring gap: a legacy 01:30 row reads forward by the gap (02:30 BST)', () => {
    expect(bookingStartUtc(day('2026-03-29'), '01:30')?.toISOString()).toBe(
      '2026-03-29T01:30:00.000Z'
    );
  });

  it('autumn change day 2026-10-25: ambiguous 01:30 takes the later occurrence (GMT)', () => {
    expect(bookingStartUtc(day('2026-10-25'), '01:30')?.toISOString()).toBe(
      '2026-10-25T01:30:00.000Z'
    );
    const r = resolveLondonWall(2026, 10, 25, 1, 30);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') expect(r.earlier.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(bookingStartUtc(day('2026-10-25'), '09:00')?.toISOString()).toBe(
      '2026-10-25T09:00:00.000Z'
    );
  });
});

describe('bookingEndUtc', () => {
  it('23:30 plus 2h crosses midnight to 01:30 London next day', () => {
    expect(bookingEndUtc(day('2026-07-15'), '23:30', 2)?.toISOString()).toBe(
      '2026-07-16T00:30:00.000Z'
    );
  });

  it('multi-hour job spanning the autumn change lasts its real length', () => {
    // 00:00 BST (23:00Z) plus 4 elapsed hours is 03:00Z, which is 03:00 GMT.
    expect(bookingEndUtc(day('2026-10-25'), '00:00', 4)?.toISOString()).toBe(
      '2026-10-25T03:00:00.000Z'
    );
  });

  it('Flexible falls back to the London day start for loud clocks', () => {
    expect(bookingEndOrDayEndUtc(day('2026-07-15'), 'Flexible', 3).toISOString()).toBe(
      '2026-07-15T02:00:00.000Z'
    );
  });
});

describe('London day bounds', () => {
  it('BST day starts 23:00Z the evening before', () => {
    expect(londonDayStartUtc(day('2026-07-15')).toISOString()).toBe('2026-07-14T23:00:00.000Z');
    expect(londonDayEndUtc(day('2026-07-15')).toISOString()).toBe('2026-07-15T22:59:59.999Z');
  });

  it('the spring day is 23 hours long and the autumn day 25', () => {
    const len = (iso: string) =>
      londonDayEndUtc(day(iso)).getTime() + 1 - londonDayStartUtc(day(iso)).getTime();
    expect(len('2026-03-29')).toBe(23 * 60 * MIN);
    expect(len('2026-10-25')).toBe(25 * 60 * MIN);
  });
});

describe('validateBookingSlot', () => {
  it('rejects the nonexistent spring times', () => {
    expect(validateBookingSlot('2026-03-29', '01:00')).toEqual({
      ok: false,
      reason: 'NONEXISTENT_TIME',
    });
    expect(validateBookingSlot('2026-03-29', '01:59')).toEqual({
      ok: false,
      reason: 'NONEXISTENT_TIME',
    });
    expect(validateBookingSlot('2026-03-29', '02:00').ok).toBe(true);
    expect(validateBookingSlot('2026-03-29', '00:59').ok).toBe(true);
  });

  it('accepts the ambiguous autumn times as the later occurrence', () => {
    const r = validateBookingSlot('2026-10-25', '01:30');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.start?.toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  it('rejects bad dates and times; Flexible only when allowed', () => {
    expect(validateBookingSlot('2026-02-30', '10:00')).toEqual({
      ok: false,
      reason: 'INVALID_DATE',
    });
    expect(validateBookingSlot('2026-07-15', '7pm')).toEqual({
      ok: false,
      reason: 'INVALID_TIME',
    });
    expect(validateBookingSlot('2026-07-15', 'Flexible')).toEqual({
      ok: false,
      reason: 'INVALID_TIME',
    });
    expect(validateBookingSlot('2026-07-15', 'Flexible', { allowFlexible: true }).ok).toBe(true);
  });
});

// The D-f boundary table: refused one minute before opensAt, allowed at it.
describe('transitionWindow: fixed time', () => {
  const cases: {
    name: string;
    date: string;
    time: string;
    hours: number;
    target: 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED';
    opensAt: string;
  }[] = [
    // A normal BST day, 14:00 start (13:00Z), 3 hours.
    {
      name: 'BST en route',
      date: '2026-07-15',
      time: '14:00',
      hours: 3,
      target: 'EN_ROUTE',
      opensAt: '2026-07-15T11:00:00.000Z',
    },
    {
      name: 'BST in progress',
      date: '2026-07-15',
      time: '14:00',
      hours: 3,
      target: 'IN_PROGRESS',
      opensAt: '2026-07-15T12:30:00.000Z',
    },
    {
      name: 'BST complete',
      date: '2026-07-15',
      time: '14:00',
      hours: 3,
      target: 'COMPLETED',
      opensAt: '2026-07-15T15:30:00.000Z',
    },
    // Spring change day 2026-03-29, 09:00 BST (08:00Z), 2 hours.
    {
      name: 'spring en route',
      date: '2026-03-29',
      time: '09:00',
      hours: 2,
      target: 'EN_ROUTE',
      opensAt: '2026-03-29T06:00:00.000Z',
    },
    {
      name: 'spring in progress',
      date: '2026-03-29',
      time: '09:00',
      hours: 2,
      target: 'IN_PROGRESS',
      opensAt: '2026-03-29T07:30:00.000Z',
    },
    {
      name: 'spring complete',
      date: '2026-03-29',
      time: '09:00',
      hours: 2,
      target: 'COMPLETED',
      opensAt: '2026-03-29T09:30:00.000Z',
    },
    // Spring change day, 03:00 BST start: its en route window opens 01:00 GMT,
    // the instant before the jump.
    {
      name: 'spring early en route',
      date: '2026-03-29',
      time: '03:00',
      hours: 2,
      target: 'EN_ROUTE',
      opensAt: '2026-03-29T00:00:00.000Z',
    },
    // Autumn change day 2026-10-25, 09:00 GMT, 2 hours.
    {
      name: 'autumn en route',
      date: '2026-10-25',
      time: '09:00',
      hours: 2,
      target: 'EN_ROUTE',
      opensAt: '2026-10-25T07:00:00.000Z',
    },
    {
      name: 'autumn in progress',
      date: '2026-10-25',
      time: '09:00',
      hours: 2,
      target: 'IN_PROGRESS',
      opensAt: '2026-10-25T08:30:00.000Z',
    },
    {
      name: 'autumn complete',
      date: '2026-10-25',
      time: '09:00',
      hours: 2,
      target: 'COMPLETED',
      opensAt: '2026-10-25T10:30:00.000Z',
    },
    // 23:30 start with 2 hours: COMPLETED from 01:00 London the next day.
    {
      name: 'midnight complete',
      date: '2026-07-15',
      time: '23:30',
      hours: 2,
      target: 'COMPLETED',
      opensAt: '2026-07-16T00:00:00.000Z',
    },
    {
      name: 'midnight complete GMT',
      date: '2026-01-15',
      time: '23:30',
      hours: 2,
      target: 'COMPLETED',
      opensAt: '2026-01-16T01:00:00.000Z',
    },
    // Multi-hour job: 08:00 with 7 hours completes from 14:30 London.
    {
      name: 'long job complete',
      date: '2026-07-15',
      time: '08:00',
      hours: 7,
      target: 'COMPLETED',
      opensAt: '2026-07-15T13:30:00.000Z',
    },
  ];

  for (const c of cases) {
    it(`${c.name}: refused at opensAt minus 60s, allowed at opensAt`, () => {
      const booking = { date: day(c.date), startTime: c.time, duration: c.hours };
      const open = at(c.opensAt);
      const before = transitionWindow(c.target, booking, new Date(open.getTime() - 60_000));
      expect(before.allowed).toBe(false);
      expect(before.opensAt?.toISOString()).toBe(c.opensAt);
      expect(transitionWindow(c.target, booking, open).allowed).toBe(true);
    });
  }

  it('CANCELLED has no window', () => {
    expect(
      transitionWindow(
        'CANCELLED',
        { date: day('2027-01-01'), startTime: '10:00', duration: 2 },
        at('2026-01-01T00:00:00Z')
      ).allowed
    ).toBe(true);
  });
});

describe('transitionWindow: Flexible (James-ruled)', () => {
  const flex = { date: day('2026-07-15'), startTime: 'Flexible', duration: 3 };

  it('EN_ROUTE and IN_PROGRESS open at 06:00 London on the day', () => {
    for (const target of ['EN_ROUTE', 'IN_PROGRESS'] as const) {
      expect(transitionWindow(target, flex, at('2026-07-15T04:59:00Z')).allowed).toBe(false);
      expect(transitionWindow(target, flex, at('2026-07-15T05:00:00Z')).allowed).toBe(true);
    }
  });

  it('COMPLETED needs a start first', () => {
    const r = transitionWindow('COMPLETED', flex, at('2026-07-15T20:00:00Z'));
    expect(r).toEqual({ allowed: false, opensAt: null, code: 'NEEDS_START' });
  });

  it('COMPLETED anchors to checkedInAt plus duration minus 30 minutes', () => {
    const started = { ...flex, checkedInAt: at('2026-07-15T09:10:00Z') };
    expect(transitionWindow('COMPLETED', started, at('2026-07-15T11:39:00Z')).allowed).toBe(false);
    const ok = transitionWindow('COMPLETED', started, at('2026-07-15T11:40:00Z'));
    expect(ok.allowed).toBe(true);
    expect(ok.opensAt?.toISOString()).toBe('2026-07-15T11:40:00.000Z');
  });

  it('Flexible on the spring change day opens at 06:00 BST (05:00Z)', () => {
    const f = { date: day('2026-03-29'), startTime: 'Flexible', duration: 2 };
    expect(transitionWindow('EN_ROUTE', f, at('2026-03-29T04:59:00Z')).allowed).toBe(false);
    expect(transitionWindow('EN_ROUTE', f, at('2026-03-29T05:00:00Z')).allowed).toBe(true);
  });
});

describe('formatLondonClock', () => {
  it('renders the London wall time', () => {
    expect(formatLondonClock(at('2026-07-15T13:00:00Z'))).toBe('14:00 on Wednesday 15 July');
  });
});
