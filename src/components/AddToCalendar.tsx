'use client';

import { getGoogleCalendarUrl, getOutlookCalendarUrl } from '@/lib/utils/calendar';

interface AddToCalendarProps {
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  durationHours: number;
}

export default function AddToCalendar({
  title,
  description,
  location,
  date,
  time,
  durationHours,
}: AddToCalendarProps) {
  const event = { title, description, location, startDate: date, startTime: time, durationHours };

  const googleUrl = getGoogleCalendarUrl(event);
  const outlookUrl = getOutlookCalendarUrl(event);

  const icsParams = new URLSearchParams({
    title,
    date,
    time,
    duration: String(durationHours),
    location,
    description,
  });
  const icsUrl = `/api/calendar?${icsParams.toString()}`;

  return (
    <div className="mt-6">
      <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 text-center">
        Add to calendar
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-cream-2 px-4 py-2.5 font-jost text-xs font-normal text-ink hover:bg-cream transition"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V8.25h15V19.5z" />
          </svg>
          Google Calendar
        </a>
        <a
          href={outlookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-cream-2 px-4 py-2.5 font-jost text-xs font-normal text-ink hover:bg-cream transition"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V8.25h15V19.5z" />
          </svg>
          Outlook / Teams
        </a>
        <a
          href={icsUrl}
          download="rena-booking.ics"
          className="inline-flex items-center gap-2 bg-cream-2 px-4 py-2.5 font-jost text-xs font-normal text-ink hover:bg-cream transition"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download .ics
        </a>
      </div>
    </div>
  );
}
