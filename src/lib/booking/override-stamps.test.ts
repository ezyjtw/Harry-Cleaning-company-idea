import { describe, expect, it } from 'vitest';

import { needsCheckInStamp } from './override-stamps';

describe('needsCheckInStamp (break-glass override into IN_PROGRESS)', () => {
  it('stamps a Flexible booking with no check-in', () => {
    expect(needsCheckInStamp({ startTime: 'Flexible', checkedInAt: null }, 'IN_PROGRESS')).toBe(
      true
    );
  });

  it('keeps an existing check-in, leaves fixed times and other targets alone', () => {
    expect(
      needsCheckInStamp({ startTime: 'Flexible', checkedInAt: new Date() }, 'IN_PROGRESS')
    ).toBe(false);
    expect(needsCheckInStamp({ startTime: '10:00', checkedInAt: null }, 'IN_PROGRESS')).toBe(false);
    expect(needsCheckInStamp({ startTime: 'Flexible', checkedInAt: null }, 'EN_ROUTE')).toBe(false);
    expect(needsCheckInStamp({ startTime: 'Flexible', checkedInAt: null }, 'COMPLETED')).toBe(
      false
    );
  });
});
