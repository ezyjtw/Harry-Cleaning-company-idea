import { describe, it, expect } from 'vitest';

interface TimeRange {
  start: number;
  end: number;
}

function subtractRanges(available: TimeRange[], blocked: TimeRange[]): TimeRange[] {
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

function expandToSlots(ranges: TimeRange[], durationMins: number): string[] {
  const slots: string[] = [];
  for (const range of ranges) {
    let mins = range.start;
    while (mins + durationMins <= range.end) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      mins += 30;
    }
  }
  return slots;
}

describe('subtractRanges', () => {
  it('returns available unchanged when no blocks', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], []);
    expect(result).toEqual([{ start: 540, end: 1080 }]);
  });

  it('splits a range when block is in the middle', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], [{ start: 720, end: 780 }]);
    expect(result).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 1080 },
    ]);
  });

  it('trims from the start', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], [{ start: 500, end: 600 }]);
    expect(result).toEqual([{ start: 600, end: 1080 }]);
  });

  it('trims from the end', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], [{ start: 1020, end: 1200 }]);
    expect(result).toEqual([{ start: 540, end: 1020 }]);
  });

  it('removes range entirely when fully blocked', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], [{ start: 500, end: 1200 }]);
    expect(result).toEqual([]);
  });

  it('handles multiple blocks', () => {
    const result = subtractRanges(
      [{ start: 540, end: 1080 }],
      [
        { start: 600, end: 660 },
        { start: 900, end: 960 },
      ]
    );
    expect(result).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 900 },
      { start: 960, end: 1080 },
    ]);
  });

  it('handles non-overlapping block', () => {
    const result = subtractRanges([{ start: 540, end: 720 }], [{ start: 800, end: 900 }]);
    expect(result).toEqual([{ start: 540, end: 720 }]);
  });

  it('handles booking buffer that extends before range start', () => {
    const result = subtractRanges([{ start: 540, end: 1080 }], [{ start: 540, end: 600 }]);
    expect(result).toEqual([{ start: 600, end: 1080 }]);
  });
});

describe('expandToSlots', () => {
  it('expands a 3-hour range into 30-min slots for 2-hour booking', () => {
    const slots = expandToSlots([{ start: 540, end: 720 }], 120);
    expect(slots).toEqual(['09:00', '09:30', '10:00']);
  });

  it('returns empty when range is too short for duration', () => {
    const slots = expandToSlots([{ start: 540, end: 600 }], 120);
    expect(slots).toEqual([]);
  });

  it('returns single slot when range equals duration exactly', () => {
    const slots = expandToSlots([{ start: 540, end: 660 }], 120);
    expect(slots).toEqual(['09:00']);
  });

  it('handles multiple ranges', () => {
    const slots = expandToSlots(
      [
        { start: 540, end: 660 },
        { start: 780, end: 900 },
      ],
      60
    );
    expect(slots).toEqual(['09:00', '09:30', '10:00', '13:00', '13:30', '14:00']);
  });

  it('handles 3-hour duration', () => {
    const slots = expandToSlots([{ start: 540, end: 720 }], 180);
    expect(slots).toEqual(['09:00']);
  });

  it('returns empty for zero-length range', () => {
    const slots = expandToSlots([{ start: 540, end: 540 }], 60);
    expect(slots).toEqual([]);
  });
});
