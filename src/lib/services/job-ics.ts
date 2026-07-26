// F8: .ics generation for an accepted job — the cleaner's calendar artifact.
//
// LAW (James-ruled): access instructions and customer notes NEVER ride into
// the .ics — door codes don't belong in third-party calendar storage. The
// description carries the job-detail LINK; the link is the door. LOCATION is
// the full address, which is a post-accept artifact (same law as the detail
// page — the serving route enforces assigned-only).
//
// TIMEZONE: bookings store London wall-clock ("09:00" on a date). The event
// is emitted as DTSTART;TZID=Europe/London with a full VTIMEZONE block and
// NO conversion anywhere — a 9:00 job lands at 9:00 in January and July
// alike; DST is the calendar app's job, driven by the RRULEs below.
//
// Lifecycle honesty (on the record): the .ics is fire-and-forget. If the
// booking is later cancelled or rescheduled, the calendar event goes stale —
// the cancellation email is the correction. METHOD:CANCEL sequencing is a
// ledgered later refinement, not this build.

import { suppliesIcsLine } from '@/lib/booking/supplies';

export interface JobIcsInput {
  id: string;
  serviceLabel: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM London wall-clock
  durationHours: number;
  fullAddress: string;
  cleanerEarnings: number; // £, the cleaner's own net figure
  detailUrl: string;
  // LB-7: the supplies answer — logistics, not sensitive, so it MAY ride the
  // calendar (unlike notes/access). Null renders the honest not-specified line.
  suppliesProvided?: boolean | null;
}

// RFC 5545 text escaping: backslash, semicolon, comma, newline.
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// RFC 5545 line folding: max 75 octets per line, continuation indented.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

function wallClock(date: string, time: string, addMinutes = 0): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + addMinutes;
  const dayCarry = Math.floor(total / 1440);
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  let ymd = date.replace(/-/g, '');
  if (dayCarry > 0) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayCarry);
    ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return `${ymd}T${hh}${mm}00`;
}

export function buildJobIcs(job: JobIcsInput): string {
  const dtStart = wallClock(job.date, job.startTime);
  const dtEnd = wallClock(job.date, job.startTime, Math.round(job.durationHours * 60));
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const description =
    `${job.serviceLabel} · ${job.durationHours} hours\n` +
    `${suppliesIcsLine(job.suppliesProvided)}\n` +
    `You earn £${job.cleanerEarnings.toFixed(2)}\n` +
    `Entry details and customer notes: ${job.detailUrl}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rena Cleaning Network//Jobs//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/London',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0100',
    'TZNAME:BST',
    'DTSTART:19700329T010000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    fold(`UID:rena-job-${job.id}@renacleaning.network`),
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/London:${dtStart}`,
    `DTEND;TZID=Europe/London:${dtEnd}`,
    fold(`SUMMARY:${esc(`Rena clean — ${job.serviceLabel}`)}`),
    fold(`LOCATION:${esc(job.fullAddress)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Google-Calendar template link — same event, zero storage, ctz keeps London wall-clock. */
export function buildGoogleCalendarLink(job: JobIcsInput): string {
  const dtStart = wallClock(job.date, job.startTime);
  const dtEnd = wallClock(job.date, job.startTime, Math.round(job.durationHours * 60));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Rena clean — ${job.serviceLabel}`,
    dates: `${dtStart}/${dtEnd}`,
    ctz: 'Europe/London',
    location: job.fullAddress,
    details: `${job.serviceLabel} · ${job.durationHours} hours\nYou earn £${job.cleanerEarnings.toFixed(2)}\nEntry details and customer notes: ${job.detailUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
