'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

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
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm
const HOUR_LABELS = HOURS.map((h) => {
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h <= 12 ? h : h - 12;
  return `${display}${suffix}`;
});

function timeToHour(t: string): number {
  const [h] = t.split(':').map(Number);
  return h;
}

function slotsToHourSet(slots: TimeSlot[]): Set<number> {
  const set = new Set<number>();
  for (const s of slots) {
    const start = timeToHour(s.start);
    const end = timeToHour(s.end);
    for (let h = start; h < end; h++) {
      if (h >= HOURS[0] && h <= HOURS[HOURS.length - 1]) set.add(h);
    }
  }
  return set;
}

function hourSetToSlots(hours: Set<number>): TimeSlot[] {
  const sorted = Array.from(hours).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const slots: TimeSlot[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== prev + 1) {
      slots.push({
        start: `${start.toString().padStart(2, '0')}:00`,
        end: `${(prev + 1).toString().padStart(2, '0')}:00`,
      });
      start = sorted[i];
    }
    prev = sorted[i];
  }
  slots.push({
    start: `${start.toString().padStart(2, '0')}:00`,
    end: `${(prev + 1).toString().padStart(2, '0')}:00`,
  });
  return slots;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<Record<DayOfWeek, Set<number>>>(() => {
    const init: Record<string, Set<number>> = {};
    for (const d of daysOfWeek) init[d] = new Set();
    return init as Record<DayOfWeek, Set<number>>;
  });
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');

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
        const newGrid: Record<string, Set<number>> = {};
        for (const d of daysOfWeek) {
          const apiDay = dayToApi[d];
          const slots: TimeSlot[] = data.weeklySlots?.[apiDay] || [];
          newGrid[d] = slotsToHourSet(slots);
        }
        setGrid(newGrid as Record<DayOfWeek, Set<number>>);
        setSameDayBookings(data.availableNow ?? true);
        if (data.blockedDates) setBlockedDates(data.blockedDates);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const toggleCell = useCallback((day: DayOfWeek, hour: number) => {
    setGrid((prev) => {
      const next = { ...prev };
      const set = new Set(prev[day]);
      if (set.has(hour)) {
        set.delete(hour);
      } else {
        set.add(hour);
      }
      next[day] = set;
      return next;
    });
    setDirty(true);
    setSaved(false);
  }, []);

  const handleCellMouseDown = useCallback(
    (day: DayOfWeek, hour: number) => {
      const isActive = grid[day].has(hour);
      setDragMode(isActive ? 'remove' : 'add');
      setIsDragging(true);
      toggleCell(day, hour);
    },
    [grid, toggleCell]
  );

  const handleCellMouseEnter = useCallback(
    (day: DayOfWeek, hour: number) => {
      if (!isDragging) return;
      setGrid((prev) => {
        const next = { ...prev };
        const set = new Set(prev[day]);
        if (dragMode === 'add') {
          set.add(hour);
        } else {
          set.delete(hour);
        }
        next[day] = set;
        return next;
      });
      setDirty(true);
      setSaved(false);
    },
    [isDragging, dragMode]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const clearDay = (day: DayOfWeek) => {
    setGrid((prev) => ({ ...prev, [day]: new Set<number>() }));
    setDirty(true);
    setSaved(false);
  };

  const fillDay = (day: DayOfWeek) => {
    setGrid((prev) => ({
      ...prev,
      [day]: new Set(HOURS),
    }));
    setDirty(true);
    setSaved(false);
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
    setSaving(true);
    try {
      const weeklySlots: Record<string, TimeSlot[]> = {};
      for (const d of daysOfWeek) {
        weeklySlots[dayToApi[d]] = hourSetToSlots(grid[d]);
      }
      await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklySlots,
          blockedDates,
          availableNow: sameDayBookings,
        }),
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silently fail for now
    } finally {
      setSaving(false);
    }
  }, [grid, blockedDates, sameDayBookings]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-48" />
          <div className="h-96 bg-ink/5 rounded-xl" />
        </div>
      </div>
    );
  }

  const totalHours = daysOfWeek.reduce((sum, d) => sum + grid[d].size, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Availability</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          Click or drag on the calendar to mark when you&apos;re available
        </p>
      </div>

      {/* Same-day bookings toggle */}
      <div
        className="rounded-xl bg-white p-5 mb-6"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-jost text-sm font-light text-ink">Available for same-day bookings</p>
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

      {/* Weekly Calendar Grid */}
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
              {totalHours} hours per week
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm bg-gold/20"
                style={{ border: '1px solid rgba(47,128,237,0.3)' }}
              />
              <span className="font-jost text-[11px] text-ink-3">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm bg-cream"
                style={{ border: '1px solid rgba(14,14,12,0.08)' }}
              />
              <span className="font-jost text-[11px] text-ink-3">Unavailable</span>
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto select-none" onMouseLeave={handleMouseUp}>
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="w-16 px-3 py-3" />
                {daysOfWeek.map((day) => (
                  <th key={day} className="px-1 py-3 text-center">
                    <span className="font-jost text-[12px] font-medium text-ink hidden sm:inline">
                      {day}
                    </span>
                    <span className="font-jost text-[12px] font-medium text-ink sm:hidden">
                      {dayAbbrevs[day]}
                    </span>
                    <div className="mt-1 flex justify-center gap-1">
                      <button
                        onClick={() => fillDay(day)}
                        className="font-jost text-[9px] uppercase tracking-wider text-gold hover:text-gold/70 transition"
                        title="Select all"
                      >
                        All
                      </button>
                      <span className="text-ink-3/30">|</span>
                      <button
                        onClick={() => clearDay(day)}
                        className="font-jost text-[9px] uppercase tracking-wider text-ink-3 hover:text-ink transition"
                        title="Clear all"
                      >
                        Clear
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour, hi) => (
                <tr key={hour}>
                  <td className="px-3 py-0 text-right align-top">
                    <span className="font-jost text-[11px] font-light text-ink-3 leading-none">
                      {HOUR_LABELS[hi]}
                    </span>
                  </td>
                  {daysOfWeek.map((day) => {
                    const active = grid[day].has(hour);
                    return (
                      <td key={day} className="px-1 py-0">
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCellMouseDown(day, hour);
                          }}
                          onMouseEnter={() => handleCellMouseEnter(day, hour)}
                          className={`h-8 rounded-sm cursor-pointer transition-colors ${
                            active ? 'bg-gold/20 hover:bg-gold/30' : 'bg-cream hover:bg-cream-2'
                          }`}
                          style={{
                            border: active
                              ? '1px solid rgba(47,128,237,0.3)'
                              : '1px solid rgba(14,14,12,0.05)',
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick summary per day */}
        <div
          className="px-6 py-4 flex flex-wrap gap-3"
          style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}
        >
          {daysOfWeek.map((day) => {
            const slots = hourSetToSlots(grid[day]);
            return (
              <div key={day} className="flex items-center gap-1.5">
                <span className="font-jost text-[11px] font-medium text-ink">
                  {dayAbbrevs[day]}:
                </span>
                {slots.length === 0 ? (
                  <span className="font-jost text-[11px] font-light text-ink-3">Off</span>
                ) : (
                  slots.map((s, i) => (
                    <span key={i} className="font-jost text-[11px] font-light text-ink-2">
                      {s.start}–{s.end}
                      {i < slots.length - 1 ? ',' : ''}
                    </span>
                  ))
                )}
              </div>
            );
          })}
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
        {dirty && (
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
