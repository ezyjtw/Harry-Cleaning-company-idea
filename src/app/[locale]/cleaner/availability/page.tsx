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

// Half-hour time slots from 7:00 to 21:00
const HALF_HOURS: string[] = [];
for (let h = 7; h <= 21; h++) {
  HALF_HOURS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 21) HALF_HOURS.push(`${h.toString().padStart(2, '0')}:30`);
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return mStr === '00' ? `${display}${suffix}` : `${display}:${mStr}${suffix}`;
}

function slotsToIndexSet(slots: TimeSlot[]): Set<number> {
  const set = new Set<number>();
  for (const s of slots) {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    const startIdx = (sh - 7) * 2 + (sm >= 30 ? 1 : 0);
    const endIdx = (eh - 7) * 2 + (em >= 30 ? 1 : 0);
    for (let i = startIdx; i < endIdx; i++) {
      if (i >= 0 && i < HALF_HOURS.length) set.add(i);
    }
  }
  return set;
}

function indexSetToSlots(indices: Set<number>): TimeSlot[] {
  const sorted = Array.from(indices).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const slots: TimeSlot[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== prev + 1) {
      slots.push({ start: HALF_HOURS[start], end: indexToEndTime(prev) });
      start = sorted[i];
    }
    prev = sorted[i];
  }
  slots.push({ start: HALF_HOURS[start], end: indexToEndTime(prev) });
  return slots;
}

function indexToEndTime(idx: number): string {
  const time = HALF_HOURS[idx];
  const [h, m] = time.split(':').map(Number);
  if (m === 0) return `${h.toString().padStart(2, '0')}:30`;
  return `${(h + 1).toString().padStart(2, '0')}:00`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const thisMonday = getMonday(today);
  const weekStart = new Date(thisMonday);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEnd = weekDates[6];

  const blockedSet = new Set(blockedDates.map((b) => b.date));

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isDayBlocked = (dayIdx: number) => {
    const dateStr = weekDates[dayIdx].toISOString().split('T')[0];
    return blockedSet.has(dateStr);
  };

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
          newGrid[d] = slotsToIndexSet(slots);
        }
        setGrid(newGrid as Record<DayOfWeek, Set<number>>);
        setSameDayBookings(data.availableNow ?? true);
        if (data.blockedDates) setBlockedDates(data.blockedDates);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const toggleCell = useCallback((day: DayOfWeek, idx: number) => {
    setGrid((prev) => {
      const next = { ...prev };
      const set = new Set(prev[day]);
      if (set.has(idx)) {
        set.delete(idx);
      } else {
        set.add(idx);
      }
      next[day] = set;
      return next;
    });
    setDirty(true);
    setSaved(false);
  }, []);

  const handleCellMouseDown = useCallback(
    (day: DayOfWeek, idx: number) => {
      const isActive = grid[day].has(idx);
      setDragMode(isActive ? 'remove' : 'add');
      setIsDragging(true);
      toggleCell(day, idx);
    },
    [grid, toggleCell]
  );

  const handleCellMouseEnter = useCallback(
    (day: DayOfWeek, idx: number) => {
      if (!isDragging) return;
      setGrid((prev) => {
        const next = { ...prev };
        const set = new Set(prev[day]);
        if (dragMode === 'add') {
          set.add(idx);
        } else {
          set.delete(idx);
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
      [day]: new Set(HALF_HOURS.map((_, i) => i)),
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
        weeklySlots[dayToApi[d]] = indexSetToSlots(grid[d]);
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

  const totalHalfHours = daysOfWeek.reduce((sum, d) => sum + grid[d].size, 0);
  const totalHours = totalHalfHours / 2;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Availability</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          Click or drag on the calendar to mark when you&apos;re available
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
              {totalHours} hours per week &middot; This template repeats every week
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

        {/* Week navigation */}
        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(14,14,12,0.04)' }}
        >
          <button
            onClick={() => setWeekOffset((w) => Math.max(w - 1, 0))}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg hover:bg-cream transition disabled:opacity-30"
          >
            <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="font-jost text-[13px] font-light text-ink">
            {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
            {weekOffset === 0 && (
              <span className="ml-2 text-gold font-medium text-[11px]">This week</span>
            )}
          </span>
          <button
            onClick={() => setWeekOffset((w) => Math.min(w + 1, 8))}
            disabled={weekOffset >= 8}
            className="p-1.5 rounded-lg hover:bg-cream transition disabled:opacity-30"
          >
            <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto select-none" onMouseLeave={handleMouseUp}>
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="w-14 px-2 py-3" />
                {daysOfWeek.map((day, i) => {
                  const blocked = isDayBlocked(i);
                  return (
                    <th key={day} className="px-0.5 py-3 text-center">
                      <span
                        className={`font-jost text-[11px] font-medium ${blocked ? 'text-ink-3/40' : 'text-ink-3'}`}
                      >
                        {dayAbbrevs[day]}
                      </span>
                      <br />
                      <span
                        className={`font-jost text-[11px] ${
                          isToday(weekDates[i])
                            ? 'text-gold font-medium'
                            : blocked
                              ? 'text-ink-3/40'
                              : 'text-ink-3 font-light'
                        }`}
                      >
                        {weekDates[i].getDate()}
                      </span>
                      {blocked && (
                        <span className="block font-jost text-[8px] uppercase text-red-400">
                          Blocked
                        </span>
                      )}
                      {!blocked && (
                        <div className="mt-1 flex justify-center gap-1">
                          <button
                            onClick={() => fillDay(day)}
                            className="font-jost text-[8px] uppercase tracking-wider text-gold hover:text-gold/70 transition"
                          >
                            All
                          </button>
                          <span className="text-ink-3/20 text-[8px]">|</span>
                          <button
                            onClick={() => clearDay(day)}
                            className="font-jost text-[8px] uppercase tracking-wider text-ink-3 hover:text-ink transition"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HALF_HOURS.map((time, ri) => {
                const isHour = time.endsWith(':00');
                return (
                  <tr key={time}>
                    <td className="px-2 py-0 text-right align-top">
                      {isHour && (
                        <span className="font-jost text-[10px] font-light text-ink-3 leading-none">
                          {formatTime(time)}
                        </span>
                      )}
                    </td>
                    {daysOfWeek.map((day, di) => {
                      const blocked = isDayBlocked(di);
                      const active = !blocked && grid[day].has(ri);
                      return (
                        <td key={day} className="px-0.5 py-0">
                          <div
                            onMouseDown={(e) => {
                              if (blocked) return;
                              e.preventDefault();
                              handleCellMouseDown(day, ri);
                            }}
                            onMouseEnter={() => {
                              if (!blocked) handleCellMouseEnter(day, ri);
                            }}
                            className={`h-4 ${isHour ? 'rounded-t-sm' : 'rounded-b-sm'} ${
                              blocked
                                ? 'bg-ink/5 cursor-not-allowed'
                                : active
                                  ? 'bg-gold/20 hover:bg-gold/30 cursor-pointer'
                                  : 'bg-cream hover:bg-cream-2 cursor-pointer'
                            } transition-colors`}
                            style={{
                              border: active
                                ? '1px solid rgba(47,128,237,0.3)'
                                : '1px solid rgba(14,14,12,0.04)',
                              borderTop: isHour || active ? undefined : 'none',
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick summary per day */}
        <div
          className="px-6 py-4 flex flex-wrap gap-3"
          style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}
        >
          {daysOfWeek.map((day) => {
            const slots = indexSetToSlots(grid[day]);
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
