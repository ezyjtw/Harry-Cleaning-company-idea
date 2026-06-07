'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────

interface AvailabilityDate {
  date: string;
  dayOfWeek: number;
  availableSlotCount: number;
  slots: string[];
  isFullyBooked: boolean;
  isPast: boolean;
}

export interface DateTimeSelection {
  date: string;
  time: string;
  time24: string;
}

interface DateTimePickerProps {
  cleanerId?: string;
  staticDates?: AvailabilityDate[];
  durationHours: number;
  value: DateTimeSelection | null;
  onChange: (selection: DateTimeSelection | null) => void;
  daysAhead?: number;
  dateLabel?: string;
  timeLabel?: string;
  dateSubtitle?: string;
  timeSubtitle?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

const BOOKING_WINDOW_DAYS = 56;
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function getMonday(d: Date): Date {
  const result = new Date(d);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function getSunday(d: Date): Date {
  const result = new Date(d);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function generateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setHours(12, 0, 0, 0);
  const endTime = new Date(end);
  endTime.setHours(12, 0, 0, 0);
  while (current <= endTime) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatMobileDate(dateStr: string): { dayName: string; dateNumber: number; month: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    dateNumber: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

// ─── Component ──────────────────────────────────────────────────

export default function DateTimePicker({
  cleanerId,
  staticDates,
  durationHours,
  value,
  onChange,
  daysAhead = BOOKING_WINDOW_DAYS,
  dateLabel = 'Pick a date',
  timeLabel = 'Pick a time',
  dateSubtitle,
  timeSubtitle,
}: DateTimePickerProps) {
  const [fetchedDates, setFetchedDates] = useState<AvailabilityDate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => toDateString(today), [today]);

  const windowEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    return d;
  }, [today, daysAhead]);

  const windowEndStr = useMemo(() => toDateString(windowEnd), [windowEnd]);

  const fetchAvailability = useCallback(async () => {
    if (!cleanerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cleaners/${cleanerId}/availability?from=${todayStr}&to=${windowEndStr}&duration=${durationHours}`
      );
      if (!res.ok) throw new Error('Failed to load availability');
      const data = await res.json();
      setFetchedDates(data.dates);
    } catch {
      setError('Could not load availability. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cleanerId, todayStr, windowEndStr, durationHours]);

  useEffect(() => {
    if (cleanerId) fetchAvailability();
  }, [cleanerId, fetchAvailability]);

  const dates = useMemo(() => fetchedDates ?? staticDates ?? [], [fetchedDates, staticDates]);

  const dateMap = useMemo(() => {
    const map = new Map<string, AvailabilityDate>();
    for (const d of dates) map.set(d.date, d);
    return map;
  }, [dates]);

  const calendarGrid = useMemo(() => {
    const gridStart = getMonday(today);
    const gridEnd = getSunday(windowEnd);
    return generateDateRange(gridStart, gridEnd);
  }, [today, windowEnd]);

  const bookableDates = useMemo(() => {
    return dates.filter(
      (d) => !d.isPast && d.date > todayStr && d.date <= windowEndStr && d.availableSlotCount > 0
    );
  }, [dates, todayStr, windowEndStr]);

  const selectedDate = value?.date ?? null;

  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return dateMap.get(selectedDate)?.slots ?? [];
  }, [selectedDate, dateMap]);

  const handleDateSelect = (date: string) => {
    if (date === selectedDate) {
      onChange(null);
    } else {
      onChange({ date, time: '', time24: '' });
    }
  };

  const handleTimeSelect = (time24: string) => {
    if (!selectedDate) return;
    const time = to12h(time24);
    if (value?.time24 === time24) {
      onChange({ date: selectedDate, time: '', time24: '' });
    } else {
      onChange({ date: selectedDate, time, time24 });
    }
  };

  const getCellState = (dateStr: string) => {
    const isToday = dateStr === todayStr;
    const dateData = dateMap.get(dateStr);
    const isPast = dateData?.isPast ?? dateStr < todayStr;
    const isBeyondWindow = dateStr > windowEndStr;
    const slotCount = dateData?.availableSlotCount ?? 0;
    const isFullyBooked = dateData?.isFullyBooked ?? false;
    const isDimmed = isPast || isToday || isBeyondWindow;
    const isBookable = !isDimmed && slotCount > 0;
    const isSelected = dateStr === selectedDate;

    return {
      isToday,
      isPast,
      isBeyondWindow,
      slotCount,
      isFullyBooked,
      isDimmed,
      isBookable,
      isSelected,
    };
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink/60" />
          <p className="font-jost text-sm font-light text-ink-3">Loading availability…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
        <p className="font-jost text-sm font-light text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchAvailability}
          className="mt-3 font-jost text-sm font-light text-ink underline underline-offset-2 hover:text-ink-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date selection */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
        <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">{dateLabel}</h2>
        {dateSubtitle && (
          <p className="mt-2 font-jost text-sm font-light text-ink-3">{dateSubtitle}</p>
        )}

        {/* Desktop / tablet: 7-column calendar grid */}
        <div className="mt-5 hidden sm:block">
          <div className="grid grid-cols-7 gap-2">
            {DAY_HEADERS.map((day) => (
              <div
                key={day}
                className="pb-2 text-center font-jost text-xs font-light uppercase tracking-wide text-ink-3"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarGrid.map((dateStr) => {
              const { isToday, isDimmed, slotCount, isFullyBooked, isBookable, isSelected } =
                getCellState(dateStr);
              const dateNum = new Date(`${dateStr}T12:00:00`).getDate();
              const isUnavailable = !isDimmed && slotCount === 0;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!isBookable}
                  onClick={() => isBookable && handleDateSelect(dateStr)}
                  className={`flex flex-col items-center justify-center rounded-lg px-1 py-2.5 font-jost text-sm ring-1 transition-all ${
                    isSelected
                      ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                      : isDimmed
                        ? 'cursor-default bg-cream/50 text-ink-3/40 ring-transparent'
                        : isUnavailable
                          ? 'cursor-default bg-cream/80 text-ink-3/60 ring-ink/[0.04]'
                          : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                  }`}
                >
                  <span className={`text-sm font-light ${isSelected ? 'font-normal' : ''}`}>
                    {dateNum}
                  </span>
                  {isToday && (
                    <span className="mt-0.5 text-[10px] font-light text-ink-3/50">Today</span>
                  )}
                  {!isDimmed && slotCount > 0 && (
                    <span className="mt-0.5 text-[10px] font-light text-ink-3">
                      {slotCount} {slotCount === 1 ? 'slot' : 'slots'}
                    </span>
                  )}
                  {isUnavailable && isFullyBooked && (
                    <span className="mt-0.5 text-[10px] font-light text-ink-3/70">Booked</span>
                  )}
                  {isUnavailable && !isFullyBooked && (
                    <span className="mt-0.5 text-[10px] font-light text-ink-3/50">—</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: stacked list of bookable dates only */}
        <div className="mt-5 space-y-2 sm:hidden">
          {bookableDates.length > 0 ? (
            bookableDates.map((d) => {
              const { dayName, dateNumber, month } = formatMobileDate(d.date);
              const isSelected = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => handleDateSelect(d.date)}
                  className={`flex w-full items-center justify-between rounded-lg px-5 py-3.5 font-jost text-sm font-light ring-1 transition-all ${
                    isSelected
                      ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                      : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                  }`}
                >
                  <span>
                    {dayName} {dateNumber} {month}
                  </span>
                  <span className="text-ink-3">
                    {d.availableSlotCount} {d.availableSlotCount === 1 ? 'slot' : 'slots'}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="font-jost text-sm font-light text-ink-3">
              No available dates. Please try a different cleaner or check back later.
            </p>
          )}
        </div>
      </div>

      {/* Time selection — appears below calendar after date click */}
      {selectedDate && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
          <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">{timeLabel}</h2>
          {timeSubtitle && (
            <p className="mt-2 font-jost text-sm font-light text-ink-3">{timeSubtitle}</p>
          )}

          {selectedDateSlots.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {selectedDateSlots.map((time24) => (
                <button
                  key={time24}
                  type="button"
                  onClick={() => handleTimeSelect(time24)}
                  className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                    value?.time24 === time24
                      ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                      : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                  }`}
                >
                  {to12h(time24)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-5 font-jost text-sm font-light text-ink-3">
              No available times on this date. Please try another date.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
