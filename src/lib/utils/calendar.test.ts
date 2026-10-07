import { describe, expect, it } from 'vitest';

import { eventWindow, generateICS, getGoogleCalendarUrl, getOutlookCalendarUrl } from './calendar';

// B3 gate (James-ruled): the invite's instants are London's wall clock,
// whatever the host's zone. Run under TZ=UTC, Europe/London and
// Pacific/Auckland; the results must not move.
const base = { title: 'Clean', description: 'd', location: 'l', durationHours: 2 };

describe('calendar instants (GMT and BST)', () => {
  it('GMT: 10:00 on 15 Jan is 10:00Z', () => {
    const ics = generateICS({ ...base, startDate: '2026-01-15', startTime: '10:00' });
    expect(ics).toContain('DTSTART:20260115T100000Z');
    expect(ics).toContain('DTEND:20260115T120000Z');
  });

  it('BST: 10:00 on 15 Jul is 09:00Z', () => {
    const ics = generateICS({ ...base, startDate: '2026-07-15', startTime: '10:00' });
    expect(ics).toContain('DTSTART:20260715T090000Z');
    expect(ics).toContain('DTEND:20260715T110000Z');
  });

  it('a 12 hour clock and an ISO date with a time part read the same London day', () => {
    const w = eventWindow({ ...base, startDate: '2026-07-15T00:00:00.000Z', startTime: '2:30 PM' });
    expect(w.start.toISOString()).toBe('2026-07-15T13:30:00.000Z');
  });

  it('the change days: 29 Mar 01:30 does not exist (moves forward), 25 Oct 01:30 takes the later', () => {
    expect(
      eventWindow({ ...base, startDate: '2026-03-29', startTime: '01:30' }).start.toISOString()
    ).toBe('2026-03-29T01:30:00.000Z');
    expect(
      eventWindow({ ...base, startDate: '2026-10-25', startTime: '01:30' }).start.toISOString()
    ).toBe('2026-10-25T01:30:00.000Z');
  });

  it('Google and Outlook links carry the same instants', () => {
    const ev = { ...base, startDate: '2026-07-15', startTime: '10:00' };
    expect(decodeURIComponent(getGoogleCalendarUrl(ev))).toContain(
      'dates=20260715T090000Z/20260715T110000Z'
    );
    const outlook = new URL(getOutlookCalendarUrl(ev));
    expect(outlook.searchParams.get('startdt')).toBe('2026-07-15T09:00:00.000Z');
  });
});
