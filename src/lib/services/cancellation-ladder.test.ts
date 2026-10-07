import { afterEach, describe, expect, it, vi } from 'vitest';

import { cancellationAnchorUtc } from '@/lib/time/booking-time';

import { BookingLifecycleService } from './booking-lifecycle.service';

// B4 (James-ruled): the cancellation ladder counts from bookingStartUtc (the
// London wall clock); a Flexible clean from 06:00 Europe/London on its date.
// Stored booking dates are the UTC midnight of the London date.
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const HOUR = 60 * 60 * 1000;

function ladderAt(now: Date, date: Date, startTime: string) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return BookingLifecycleService.canCancel(cancellationAnchorUtc(date, startTime), 'CONFIRMED')
    .refundPercent;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('cancellationAnchorUtc', () => {
  it.each([
    ['GMT fixed', day(2026, 1, 15), '14:00', '2026-01-15T14:00:00.000Z'],
    ['BST fixed', day(2026, 7, 15), '14:00', '2026-07-15T13:00:00.000Z'],
    ['spring change day, after the jump', day(2026, 3, 29), '09:00', '2026-03-29T08:00:00.000Z'],
    ['autumn change day, after the fall', day(2026, 10, 25), '09:00', '2026-10-25T09:00:00.000Z'],
    ['GMT Flexible at 06:00 London', day(2026, 1, 15), 'Flexible', '2026-01-15T06:00:00.000Z'],
    ['BST Flexible at 06:00 London', day(2026, 7, 15), 'Flexible', '2026-07-15T05:00:00.000Z'],
    ['spring change day Flexible', day(2026, 3, 29), 'Flexible', '2026-03-29T05:00:00.000Z'],
    ['autumn change day Flexible', day(2026, 10, 25), 'Flexible', '2026-10-25T06:00:00.000Z'],
  ])('%s', (_label, date, start, iso) => {
    expect(cancellationAnchorUtc(date, start).toISOString()).toBe(iso);
  });
});

describe('the ladder counts from the London start, not UTC midnight', () => {
  it.each([
    ['GMT', day(2026, 1, 15), '14:00'],
    ['BST', day(2026, 7, 15), '14:00'],
    ['spring change day', day(2026, 3, 29), '09:00'],
    ['autumn change day', day(2026, 10, 25), '09:00'],
    ['Flexible in BST', day(2026, 7, 15), 'Flexible'],
  ])('%s: 100 over 48h, 50 over 24h, 0 inside 24h, measured to the minute', (_l, date, start) => {
    const anchor = cancellationAnchorUtc(date, start).getTime();
    expect(ladderAt(new Date(anchor - 48 * HOUR - 60_000), date, start)).toBe(100);
    expect(ladderAt(new Date(anchor - 48 * HOUR + 60_000), date, start)).toBe(50);
    expect(ladderAt(new Date(anchor - 24 * HOUR - 60_000), date, start)).toBe(50);
    expect(ladderAt(new Date(anchor - 24 * HOUR + 60_000), date, start)).toBe(0);
  });

  it('a 14:00 clean cancelled 30 hours ahead gets 50 percent (the UTC midnight anchor gave 0)', () => {
    const date = day(2026, 1, 15);
    const now = new Date(cancellationAnchorUtc(date, '14:00').getTime() - 30 * HOUR);
    expect(ladderAt(now, date, '14:00')).toBe(50);
    vi.setSystemTime(now);
    expect(BookingLifecycleService.canCancel(date, 'CONFIRMED').refundPercent).toBe(0);
  });
});
