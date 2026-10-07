import { describe, expect, it } from 'vitest';

import { deferToMorningLondon, isQuietHoursLondon } from './quiet-hours';

// B3: quiet hours now ride the one London helper; behaviour is unchanged.
describe('deferToMorningLondon', () => {
  it('daytime sends are untouched', () => {
    const d = new Date('2026-07-15T10:00:00Z');
    expect(deferToMorningLondon(d)).toBe(d);
  });

  it('a 22:30 BST send moves to 08:00 BST next morning', () => {
    expect(deferToMorningLondon(new Date('2026-07-15T21:30:00Z')).toISOString()).toBe(
      '2026-07-16T07:00:00.000Z'
    );
  });

  it('a 05:00 GMT send moves to 08:00 GMT the same morning', () => {
    expect(deferToMorningLondon(new Date('2026-01-15T05:00:00Z')).toISOString()).toBe(
      '2026-01-15T08:00:00.000Z'
    );
  });

  it('a night send across the spring change lands on 08:00 BST', () => {
    expect(deferToMorningLondon(new Date('2026-03-28T22:00:00Z')).toISOString()).toBe(
      '2026-03-29T07:00:00.000Z'
    );
  });

  it('a 23:00 send on the last day of a month rolls to the 1st', () => {
    expect(deferToMorningLondon(new Date('2026-01-31T23:00:00Z')).toISOString()).toBe(
      '2026-02-01T08:00:00.000Z'
    );
  });

  it('isQuietHoursLondon reads the London clock', () => {
    expect(isQuietHoursLondon(new Date('2026-07-15T20:30:00Z'))).toBe(true); // 21:30 BST
    expect(isQuietHoursLondon(new Date('2026-01-15T20:30:00Z'))).toBe(false); // 20:30 GMT
  });
});
