'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';

interface TimeSlot {
  start: string;
  end: string;
}

interface BlockedDate {
  date: string;
  reason: string;
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

const daysOfWeek: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const dayAbbrevs: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const dayToApi: Record<DayOfWeek, string> = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
};

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 22) TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return mStr === '00' ? `${display}${suffix}` : `${display}:${mStr}${suffix}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function rangesOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return (
    timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)
  );
}

function validateRanges(ranges: TimeSlot[]): string | null {
  for (const r of ranges) {
    if (r.start >= r.end)
      return `Start time (${formatTime(r.start)}) must be before end time (${formatTime(r.end)})`;
    if (timeToMinutes(r.end) - timeToMinutes(r.start) < 30)
      return 'Each range must be at least 30 minutes';
  }
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        return `Ranges overlap: ${formatTime(ranges[i].start)}–${formatTime(ranges[i].end)} and ${formatTime(ranges[j].start)}–${formatTime(ranges[j].end)}`;
      }
    }
  }
  return null;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weeklyRanges, setWeeklyRanges] = useState<Record<DayOfWeek, TimeSlot[]>>(() => {
    const init: Record<string, TimeSlot[]> = {};
    for (const d of daysOfWeek) init[d] = [];
    return init as Record<DayOfWeek, TimeSlot[]>;
  });
  const [bookingBuffer, setBookingBuffer] = useState<30 | 60>(30);
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  useEffect(() => {
    fetch('/api/cleaner/availability')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data) return;
        const newRanges: Record<string, TimeSlot[]> = {};
        for (const d of daysOfWeek) {
          const apiDay = dayToApi[d];
          const slots: TimeSlot[] = data.weeklySlots?.[apiDay] || [];
          newRanges[d] = slots;
        }
        setWeeklyRanges(newRanges as Record<DayOfWeek, TimeSlot[]>);
        setSameDayBookings(data.availableNow ?? true);
        if (data.blockedDates) setBlockedDates(data.blockedDates);
        if (data.bookingBufferMinutes === 60) setBookingBuffer(60);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const toggleDay = (day: DayOfWeek) => {
    setWeeklyRanges((prev) => ({
      ...prev,
      [day]: prev[day].length > 0 ? [] : [{ start: '09:00', end: '17:00' }],
    }));
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  };

  const updateRange = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
    setWeeklyRanges((prev) => {
      const ranges = [...prev[day]];
      ranges[index] = { ...ranges[index], [field]: value };
      return { ...prev, [day]: ranges };
    });
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  };

  const addRange = (day: DayOfWeek) => {
    setWeeklyRanges((prev) => {
      const existing = prev[day];
      const lastEnd = existing.length > 0 ? existing[existing.length - 1].end : '09:00';
      const newEndMins = Math.min(timeToMinutes(lastEnd) + 120, 22 * 60);
      if (timeToMinutes(lastEnd) >= newEndMins) return prev;
      const endH = Math.floor(newEndMins / 60)
        .toString()
        .padStart(2, '0');
      const endM = (newEndMins % 60).toString().padStart(2, '0');
      return { ...prev, [day]: [...existing, { start: lastEnd, end: `${endH}:${endM}` }] };
    });
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  };

  const removeRange = (day: DayOfWeek, index: number) => {
    setWeeklyRanges((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
    setDirty(true);
    setSaved(false);
    setValidationError(null);
  };

  const addBlockedDate = () => {
    if (!newBlockDate) return;
    if (blockedDates.some((b) => b.date === newBlockDate)) return;
    setBlockedDates((prev) => [
      ...prev,
      { date: newBlockDate, reason: newBlockReason || 'Unavailable' },
    ]);
    setNewBlockDate('');
    setNewBlockReason('');
    setDirty(true);
    setSaved(false);
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((b) => b.date !== date));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    for (const day of daysOfWeek) {
      const ranges = weeklyRanges[day];
      if (ranges.length === 0) continue;
      const error = validateRanges(ranges);
      if (error) {
        setValidationError(`${dayAbbrevs[day]}: ${error}`);
        return;
      }
    }

    setSaving(true);
    setValidationError(null);
    try {
      const weeklySlots: Record<string, TimeSlot[]> = {};
      for (const d of daysOfWeek) {
        weeklySlots[dayToApi[d]] = weeklyRanges[d];
      }
      const res = await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklySlots,
          blockedDates,
          availableNow: sameDayBookings,
          bookingBufferMinutes: bookingBuffer,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setValidationError(data.error || 'Failed to save');
        return;
      }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setValidationError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [weeklyRanges, blockedDates, sameDayBookings, bookingBuffer]);

  const totalHours = daysOfWeek.reduce((sum, day) => {
    return (
      sum +
      weeklyRanges[day].reduce((s, r) => {
        return s + (timeToMinutes(r.end) - timeToMinutes(r.start)) / 60;
      }, 0)
    );
  }, 0);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-48" />
          <div className="h-96 bg-ink/5 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Availability</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          Set the days and times you&apos;re available for bookings
        </p>
      </div>

      {/* Same-day bookings toggle — hidden while feature is disabled */}
      {SAME_DAY_FEATURE_ENABLED && (
        <div
          className="rounded-xl bg-white p-5 mb-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-jost text-sm font-light text-ink">
                Available for same-day bookings
              </p>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
                Allow customers to book you for today at a premium rate
              </p>
            </div>
            <button
              onClick={() => {
                setSameDayBookings(!sameDayBookings);
                setDirty(true);
                setSaved(false);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                sameDayBookings ? 'bg-gold' : 'bg-ink-3/30'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sameDayBookings ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      <div
        className="rounded-xl bg-white overflow-hidden mb-6"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}
        >
          <div>
            <h2 className="font-cormorant text-lg font-light text-ink">Weekly Schedule</h2>
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
              {totalHours} hours per week &middot; This template repeats every week
            </p>
          </div>
        </div>

        <div className="divide-y divide-ink/[0.04]">
          {daysOfWeek.map((day) => {
            const enabled = weeklyRanges[day].length > 0;
            const ranges = weeklyRanges[day];
            return (
              <div key={day} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? 'bg-gold' : 'bg-ink-3/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span
                      className={`font-jost text-sm ${enabled ? 'font-normal text-ink' : 'font-light text-ink-3'}`}
                    >
                      {day}
                    </span>
                  </div>
                  {!enabled && (
                    <span className="font-jost text-xs font-light text-ink-3">Not available</span>
                  )}
                  {enabled && (
                    <span className="font-jost text-xs font-light text-ink-3">
                      {ranges.reduce(
                        (s, r) => s + (timeToMinutes(r.end) - timeToMinutes(r.start)) / 60,
                        0
                      )}
                      h
                    </span>
                  )}
                </div>

                {enabled && (
                  <div className="mt-3 sm:ml-14 space-y-2.5">
                    {ranges.map((range, idx) => (
                      <div key={idx} className="flex items-center gap-2 flex-wrap">
                        <select
                          value={range.start}
                          onChange={(e) => updateRange(day, idx, 'start', e.target.value)}
                          className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {formatTime(t)}
                            </option>
                          ))}
                        </select>
                        <span className="font-jost text-sm font-light text-ink-3">to</span>
                        <select
                          value={range.end}
                          onChange={(e) => updateRange(day, idx, 'end', e.target.value)}
                          className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {formatTime(t)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeRange(day, idx)}
                          className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-cream transition"
                          title="Remove range"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addRange(day)}
                      className="font-jost text-xs font-light text-gold hover:text-gold/70 transition flex items-center gap-1"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add another range
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Buffer between bookings */}
      <div
        className="rounded-xl bg-white overflow-hidden mb-6"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink">Buffer Between Bookings</h2>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
            Time blocked before and after each booking for travel and preparation
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-3">
            {([30, 60] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setBookingBuffer(mins);
                  setDirty(true);
                  setSaved(false);
                }}
                className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                  bookingBuffer === mins
                    ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                    : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                }`}
              >
                {mins === 30 ? '30 minutes' : '1 hour'}
              </button>
            ))}
          </div>
          <p className="mt-3 font-jost text-xs font-light text-ink-3">
            A {bookingBuffer}-minute buffer will be blocked before and after each booking so you
            have time to travel and prepare.
          </p>
        </div>
      </div>

      {/* Blocked dates */}
      <div
        className="rounded-xl bg-white overflow-hidden mb-6"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink">Blocked Dates</h2>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
            Block specific dates when you&apos;re unavailable (holidays, personal days)
          </p>
        </div>
        <div className="px-6 py-4">
          {blockedDates.length > 0 && (
            <div className="space-y-2 mb-4">
              {blockedDates
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((bd) => (
                  <div
                    key={bd.date}
                    className="flex items-center justify-between rounded-lg bg-cream px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-4 h-4 text-ink-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                      <span className="font-jost text-sm font-light text-ink">
                        {new Date(`${bd.date}T00:00:00`).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="font-jost text-sm font-light text-ink-3">— {bd.reason}</span>
                    </div>
                    <button
                      onClick={() => removeBlockedDate(bd.date)}
                      className="text-ink-3 hover:text-ink transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="e.g. Holiday"
                className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>
            <button
              onClick={addBlockedDate}
              disabled={!newBlockDate}
              className="rounded-full px-5 py-2 bg-ink text-cream font-jost text-[13px] font-light hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              Block Date
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {validationError && (
          <span className="font-jost text-[12px] font-light text-red-600">{validationError}</span>
        )}
        {dirty && !validationError && (
          <span className="font-jost text-[12px] font-light text-amber-600">Unsaved changes</span>
        )}
        {saved && (
          <span className="font-jost text-sm font-light text-green-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Changes saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full px-8 py-2.5 bg-ink text-cream font-jost text-[13px] font-light shadow-sm hover:bg-ink/90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
