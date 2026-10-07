import { describe, expect, it } from 'vitest';

import { isSameDay } from './pricing.service';

// B3 gate (James-ruled): the same-day noon cutoff is noon London, in GMT and
// in BST, whatever the host's zone.
describe('isSameDay (noon London)', () => {
  it('GMT: before noon is same day, noon is not', () => {
    const at = new Date('2026-01-15T15:00:00Z');
    expect(isSameDay(at, new Date('2026-01-15T11:59:00Z'))).toBe(true);
    expect(isSameDay(at, new Date('2026-01-15T12:00:00Z'))).toBe(false);
  });

  it('BST: noon London is 11:00Z', () => {
    const at = new Date('2026-07-15T14:00:00Z');
    expect(isSameDay(at, new Date('2026-07-15T10:59:00Z'))).toBe(true);
    expect(isSameDay(at, new Date('2026-07-15T11:00:00Z'))).toBe(false);
  });

  it('the London day, not the UTC day: 23:30Z on 15 Jul is 16 Jul in London', () => {
    expect(isSameDay(new Date('2026-07-15T23:30:00Z'), new Date('2026-07-15T08:00:00Z'))).toBe(
      false
    );
    expect(isSameDay(new Date('2026-07-15T23:30:00Z'), new Date('2026-07-15T23:10:00Z'))).toBe(
      true
    );
  });
});
