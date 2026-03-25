/**
 * Calendar utilities — generates .ics content and "Add to Calendar" URLs.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: string; // ISO date string e.g. "2026-04-15"
  startTime: string; // e.g. "10:00 AM" or "14:00"
  durationHours: number;
}

/**
 * Parse a time string like "10:00 AM" or "14:00" into hours and minutes.
 */
function parseTime(time: string): { hours: number; minutes: number } {
  const trimmed = time.trim();

  // Try 12-hour format: "10:00 AM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Try 24-hour format: "14:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
  }

  return { hours: 9, minutes: 0 }; // fallback
}

/**
 * Format a Date as an iCalendar datetime string (UTC): "20260415T100000Z"
 */
function toICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Generate .ics file content for a booking.
 */
export function generateICS(event: CalendarEvent): string {
  const { hours, minutes } = parseTime(event.startTime);
  const start = new Date(event.startDate);
  start.setHours(hours, minutes, 0, 0);

  const end = new Date(start.getTime() + event.durationHours * 60 * 60 * 1000);
  const now = new Date();

  const uid = `booking-${Date.now()}@rena.com`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rena Cleaning Network//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Cleaning in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (match) => {
    if (match === '\n') return '\\n';
    return `\\${match}`;
  });
}

/**
 * Generate a Google Calendar "Add Event" URL.
 */
export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const { hours, minutes } = parseTime(event.startTime);
  const start = new Date(event.startDate);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + event.durationHours * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate an Outlook/Teams calendar URL.
 */
export function getOutlookCalendarUrl(event: CalendarEvent): string {
  const { hours, minutes } = parseTime(event.startTime);
  const start = new Date(event.startDate);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + event.durationHours * 60 * 60 * 1000);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: event.description,
    location: event.location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
