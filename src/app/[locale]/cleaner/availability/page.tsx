'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';

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
for (let h = 0; h <= 23; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 23) TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}
TIME_OPTIONS.push('23:59');

function formatTime(t: string): string {
  if (t === '23:59') return '11:59pm';
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

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(12, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmtShort = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  const year = sunday.getFullYear();
  return `${fmtShort(monday)} – ${fmtShort(sunday)}, ${year}`;
}

function getDayName(d: Date): DayOfWeek {
  const names: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return names[d.getDay()];
}

type Tab = 'week' | 'recurring';

export default function AvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('week');

  // Recurring weekly template
  const [weeklyRanges, setWeeklyRanges] = useState<Record<DayOfWeek, TimeSlot[]>>(() => {
    const init: Record<string, TimeSlot[]> = {};
    for (const d of daysOfWeek) init[d] = [];
    return init as Record<DayOfWeek, TimeSlot[]>;
  });

  // Date-specific slots from API
  const [dateSlots, setDateSlots] = useState<Record<string, TimeSlot[]>>({});

  const [bookingBuffer, setBookingBuffer] = useState<30 | 60>(30);
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  // Week view state
  const [weekOffset, setWeekOffset] = useState(0);
  const currentMonday = useMemo(() => {
    const base = getMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  // Day editor
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlots, setEditingSlots] = useState<TimeSlot[]>([]);
  const [editingSaving, setEditingSaving] = useState(false);
  const [copyOnEditNotice, setCopyOnEditNotice] = useState(false);

  // Always Available toggle state
  const [alwaysAvailable, setAlwaysAvailable] = useState(false);
  const [weekdayHours, setWeekdayHours] = useState<TimeSlot>({ start: '08:00', end: '18:00' });
  const [weekendHours, setWeekendHours] = useState<TimeSlot>({ start: '08:00', end: '18:00' });
  const [showAlwaysConfig, setShowAlwaysConfig] = useState(false);

  // Lock-in state
  const [lockingIn, setLockingIn] = useState(false);
  const [lockInResult, setLockInResult] = useState<string | null>(null);

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
          newRanges[d] = data.weeklySlots?.[apiDay] || [];
        }
        setWeeklyRanges(newRanges as Record<DayOfWeek, TimeSlot[]>);
        setSameDayBookings(data.availableNow ?? true);
        if (data.blockedDates) setBlockedDates(data.blockedDates);
        if (data.bookingBufferMinutes === 60) setBookingBuffer(60);
        if (data.dateSlots) setDateSlots(data.dateSlots);

        const allDaysHaveSlots = daysOfWeek.every(
          (d) => (data.weeklySlots?.[dayToApi[d]] || []).length > 0
        );
        setAlwaysAvailable(allDaysHaveSlots);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // Week days for the current view
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentMonday, i);
      return {
        date: d,
        dateStr: toDateStr(d),
        dayName: getDayName(d),
        isPast: toDateStr(d) < toDateStr(new Date()),
        isToday: toDateStr(d) === toDateStr(new Date()),
      };
    });
  }, [currentMonday]);

  function getSlotsForDate(
    dateStr: string,
    dayName: DayOfWeek
  ): { slots: TimeSlot[]; isDateSpecific: boolean } {
    if (dateSlots[dateStr] && dateSlots[dateStr].length > 0) {
      return { slots: dateSlots[dateStr], isDateSpecific: true };
    }
    return { slots: weeklyRanges[dayName] || [], isDateSpecific: false };
  }

  function isDateBlocked(dateStr: string): boolean {
    return blockedDates.some((b) => b.date === dateStr);
  }

  // ── Recurring schedule handlers ────────────────────────
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

  // ── Always Available toggle ────────────────────────
  const handleAlwaysAvailableToggle = () => {
    if (alwaysAvailable) {
      // Turning off: clear all weekly slots
      const cleared: Record<string, TimeSlot[]> = {};
      for (const d of daysOfWeek) cleared[d] = [];
      setWeeklyRanges(cleared as Record<DayOfWeek, TimeSlot[]>);
      setAlwaysAvailable(false);
    } else {
      setShowAlwaysConfig(true);
    }
    setDirty(true);
    setSaved(false);
  };

  const applyAlwaysAvailable = () => {
    const newRanges: Record<string, TimeSlot[]> = {};
    for (const d of daysOfWeek) {
      const isWeekend = d === 'Saturday' || d === 'Sunday';
      const hours = isWeekend ? weekendHours : weekdayHours;
      newRanges[d] = [{ start: hours.start, end: hours.end }];
    }
    setWeeklyRanges(newRanges as Record<DayOfWeek, TimeSlot[]>);
    setAlwaysAvailable(true);
    setShowAlwaysConfig(false);
    setDirty(true);
    setSaved(false);
  };

  // ── Day editor handlers ────────────────────────
  const openDayEditor = (dateStr: string, dayName: DayOfWeek) => {
    const { slots, isDateSpecific } = getSlotsForDate(dateStr, dayName);
    if (!isDateSpecific && slots.length > 0) {
      setCopyOnEditNotice(true);
    } else {
      setCopyOnEditNotice(false);
    }
    setEditingDate(dateStr);
    setEditingSlots(
      slots.length > 0 ? slots.map((s) => ({ ...s })) : [{ start: '09:00', end: '17:00' }]
    );
    setValidationError(null);
  };

  const updateEditingSlot = (index: number, field: 'start' | 'end', value: string) => {
    setEditingSlots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setValidationError(null);
  };

  const addEditingSlot = () => {
    setEditingSlots((prev) => {
      const lastEnd = prev.length > 0 ? prev[prev.length - 1].end : '09:00';
      const newEndMins = Math.min(timeToMinutes(lastEnd) + 120, 23 * 60 + 59);
      if (timeToMinutes(lastEnd) >= newEndMins) return prev;
      const endH = Math.floor(newEndMins / 60)
        .toString()
        .padStart(2, '0');
      const endM = (newEndMins % 60).toString().padStart(2, '0');
      return [...prev, { start: lastEnd, end: `${endH}:${endM}` }];
    });
    setValidationError(null);
  };

  const removeEditingSlot = (index: number) => {
    setEditingSlots((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const saveDateSlots = async () => {
    if (!editingDate) return;
    const error = validateRanges(editingSlots);
    if (error) {
      setValidationError(error);
      return;
    }

    setEditingSaving(true);
    try {
      const res = await fetch('/api/cleaner/availability/date-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editingDate,
          slots: editingSlots.map((s) => ({ startTime: s.start, endTime: s.end })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setValidationError(data.error || 'Failed to save');
        return;
      }
      const savedDate = editingDate;
      setDateSlots((prev) => ({
        ...prev,
        [savedDate as string]: editingSlots.map((s) => ({ ...s })),
      }));
      setEditingDate(null);
      setCopyOnEditNotice(false);
    } catch {
      setValidationError('Failed to save. Please try again.');
    } finally {
      setEditingSaving(false);
    }
  };

  const revertToRecurring = async (dateStr: string) => {
    try {
      const res = await fetch('/api/cleaner/availability/date-slots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (res.ok) {
        setDateSlots((prev) => {
          const updated = { ...prev };
          delete updated[dateStr];
          return updated;
        });
        if (editingDate === dateStr) setEditingDate(null);
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  const blockDate = (dateStr: string) => {
    if (blockedDates.some((b) => b.date === dateStr)) return;
    setBlockedDates((prev) => [...prev, { date: dateStr, reason: 'Unavailable' }]);
    setDirty(true);
    setSaved(false);
  };

  const unblockDate = (dateStr: string) => {
    setBlockedDates((prev) => prev.filter((b) => b.date !== dateStr));
    setDirty(true);
    setSaved(false);
  };

  // ── Lock-in handler ────────────────────────
  const handleLockIn = async () => {
    setLockingIn(true);
    setLockInResult(null);
    try {
      const startDate = toDateStr(currentMonday);
      const endDate = toDateStr(addDays(currentMonday, 6));
      const res = await fetch('/api/cleaner/availability/lock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setLockInResult(
          `Locked in ${data.slotsCreated} slots across ${data.lockedInDates - data.skippedDates} days`
        );
        // Refresh date slots
        const refreshRes = await fetch('/api/cleaner/availability');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.dateSlots) setDateSlots(refreshData.dateSlots);
        }
        setTimeout(() => setLockInResult(null), 4000);
      }
    } catch {
      setLockInResult('Failed to lock in. Please try again.');
    } finally {
      setLockingIn(false);
    }
  };

  // ── Blocked date add/remove ────────────────────────
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

  // ── Save recurring schedule ────────────────────────
  const handleSave = useCallback(async () => {
    for (const day of daysOfWeek) {
      const ranges = weeklyRanges[day];
      if (ranges.length === 0) continue;
      const error = validateRanges(ranges);
      if (error) {
        setValidationError(`${day}: ${error}`);
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
      <div className="mb-6">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Availability</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          Manage your weekly schedule and per-date availability
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 mb-6 rounded-lg bg-cream-2 p-1"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <button
          onClick={() => setTab('week')}
          className={`flex-1 rounded-md px-4 py-2 font-jost text-sm transition-all ${
            tab === 'week'
              ? 'bg-white text-ink shadow-sm font-normal'
              : 'text-ink-3 font-light hover:text-ink'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setTab('recurring')}
          className={`flex-1 rounded-md px-4 py-2 font-jost text-sm transition-all ${
            tab === 'recurring'
              ? 'bg-white text-ink shadow-sm font-normal'
              : 'text-ink-3 font-light hover:text-ink'
          }`}
        >
          Recurring Schedule
        </button>
      </div>

      {/* Same-day bookings toggle */}
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

      {/* ─── WEEK VIEW TAB ─────────────────────────────── */}
      {tab === 'week' && (
        <>
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setWeekOffset((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3/20 hover:border-gold/40 hover:bg-gold/5 transition-all"
            >
              <svg
                className="h-4 w-4 text-ink-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <div className="text-center">
              <h2 className="font-newsreader text-lg font-semibold text-ink">
                {formatWeekLabel(currentMonday)}
              </h2>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-gold/70 transition"
                >
                  Go to this week
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3/20 hover:border-gold/40 hover:bg-gold/5 transition-all"
            >
              <svg
                className="h-4 w-4 text-ink-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Lock-in button */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-jost text-xs font-light text-ink-3">
              Per-date edits override your recurring schedule for that specific date only
            </p>
            <button
              onClick={handleLockIn}
              disabled={lockingIn}
              className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[11px] uppercase tracking-[0.1em] hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {lockingIn ? 'Locking in…' : 'Lock in this week'}
            </button>
          </div>
          {lockInResult && (
            <p className="mb-4 font-jost text-xs font-light text-green-600">{lockInResult}</p>
          )}

          {/* Day cards */}
          <div className="space-y-3 mb-6">
            {weekDays.map(({ dateStr, dayName, isPast, isToday }) => {
              const blocked = isDateBlocked(dateStr);
              const { slots, isDateSpecific } = getSlotsForDate(dateStr, dayName);
              const isEditing = editingDate === dateStr;
              const dayHours = slots.reduce(
                (sum, s) => sum + (timeToMinutes(s.end) - timeToMinutes(s.start)) / 60,
                0
              );

              return (
                <div
                  key={dateStr}
                  className={`rounded-xl bg-white overflow-hidden transition-all ${
                    isEditing ? 'ring-2 ring-gold shadow-md' : ''
                  }`}
                  style={{ border: '1px solid rgba(14,14,12,0.06)' }}
                >
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-center min-w-[44px] ${isPast ? 'opacity-40' : ''}`}>
                        <p className="font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3">
                          {dayName.slice(0, 3)}
                        </p>
                        <p
                          className={`font-newsreader text-lg font-medium ${isToday ? 'text-gold' : 'text-ink'}`}
                        >
                          {new Date(`${dateStr}T12:00:00`).getDate()}
                        </p>
                      </div>

                      {blocked ? (
                        <span className="font-jost text-xs font-light text-red-500">Blocked</span>
                      ) : slots.length === 0 ? (
                        <span className="font-jost text-xs font-light text-ink-3">
                          Not available
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {slots.map((s, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-jost text-[11px] font-light ring-1 ${
                                isDateSpecific
                                  ? 'bg-gold/5 text-ink ring-gold/20'
                                  : 'bg-cream text-ink-2 ring-ink/[0.06]'
                              }`}
                            >
                              {formatTime(s.start)}–{formatTime(s.end)}
                            </span>
                          ))}
                          {isDateSpecific && (
                            <span className="font-jost text-[10px] uppercase tracking-[0.1em] text-gold self-center">
                              custom
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {slots.length > 0 && !blocked && (
                        <span className="font-jost text-xs font-light text-ink-3">{dayHours}h</span>
                      )}
                      {!isPast && !isEditing && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openDayEditor(dateStr, dayName)}
                            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-cream transition"
                            title="Edit this day"
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
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          {blocked ? (
                            <button
                              onClick={() => unblockDate(dateStr)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Unblock this date"
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
                          ) : (
                            <button
                              onClick={() => blockDate(dateStr)}
                              className="p-1.5 rounded-lg text-ink-3 hover:text-red-500 hover:bg-red-50 transition"
                              title="Block this date"
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
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                />
                              </svg>
                            </button>
                          )}
                          {isDateSpecific && (
                            <button
                              onClick={() => revertToRecurring(dateStr)}
                              className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-cream transition"
                              title="Revert to recurring schedule"
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
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline day editor */}
                  {isEditing && (
                    <div
                      className="px-5 pb-4 pt-1"
                      style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}
                    >
                      {copyOnEditNotice && (
                        <div className="mb-3 rounded-lg bg-gold/5 p-3 ring-1 ring-gold/20">
                          <p className="font-jost text-xs font-light text-ink-2">
                            Adding hours to this day will set this {dayName}&apos;s hours
                            independently from your usual {dayName} schedule. Your usual schedule
                            will continue for all other {dayName}s.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {editingSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2 flex-wrap">
                            <select
                              value={slot.start}
                              onChange={(e) => updateEditingSlot(idx, 'start', e.target.value)}
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
                              value={slot.end}
                              onChange={(e) => updateEditingSlot(idx, 'end', e.target.value)}
                              className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {formatTime(t)}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeEditingSlot(idx)}
                              className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-cream transition"
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
                          onClick={addEditingSlot}
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

                      {validationError && editingDate === dateStr && (
                        <p className="mt-2 font-jost text-[12px] font-light text-red-600">
                          {validationError}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={saveDateSlots}
                          disabled={editingSaving}
                          className="rounded-full px-5 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 disabled:opacity-50 transition-colors"
                        >
                          {editingSaving ? 'Saving…' : 'Save for this day'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingDate(null);
                            setCopyOnEditNotice(false);
                            setValidationError(null);
                          }}
                          className="rounded-full px-5 py-1.5 font-jost text-[12px] font-light text-ink-3 hover:text-ink transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─── RECURRING SCHEDULE TAB ────────────────────── */}
      {tab === 'recurring' && (
        <>
          {/* Always Available toggle */}
          <div
            className="rounded-xl bg-white p-5 mb-6"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-jost text-sm font-light text-ink">Always Available</p>
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
                  Set hours for all 7 days with weekday/weekend groups
                </p>
              </div>
              <button
                onClick={handleAlwaysAvailableToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  alwaysAvailable ? 'bg-gold' : 'bg-ink-3/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    alwaysAvailable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Always Available config modal */}
            {showAlwaysConfig && (
              <div className="mt-4 rounded-lg bg-cream p-4 ring-1 ring-ink/[0.06]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-jost text-xs font-normal text-ink mb-2">
                      Weekday hours (Mon–Fri)
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={weekdayHours.start}
                        onChange={(e) => setWeekdayHours((p) => ({ ...p, start: e.target.value }))}
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-white ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTime(t)}
                          </option>
                        ))}
                      </select>
                      <span className="font-jost text-xs text-ink-3">to</span>
                      <select
                        value={weekdayHours.end}
                        onChange={(e) => setWeekdayHours((p) => ({ ...p, end: e.target.value }))}
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-white ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTime(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="font-jost text-xs font-normal text-ink mb-2">
                      Weekend hours (Sat–Sun)
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={weekendHours.start}
                        onChange={(e) => setWeekendHours((p) => ({ ...p, start: e.target.value }))}
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-white ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTime(t)}
                          </option>
                        ))}
                      </select>
                      <span className="font-jost text-xs text-ink-3">to</span>
                      <select
                        value={weekendHours.end}
                        onChange={(e) => setWeekendHours((p) => ({ ...p, end: e.target.value }))}
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-white ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTime(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={applyAlwaysAvailable}
                    className="rounded-full px-5 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowAlwaysConfig(false)}
                    className="rounded-full px-5 py-1.5 font-jost text-[12px] font-light text-ink-3 hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

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
                <h2 className="font-newsreader text-lg font-semibold text-ink">Weekly Schedule</h2>
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
                        <span className="font-jost text-xs font-light text-ink-3">
                          Not available
                        </span>
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
              <h2 className="font-newsreader text-lg font-semibold text-ink">
                Buffer Between Bookings
              </h2>
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
              <h2 className="font-newsreader text-lg font-semibold text-ink">Blocked Dates</h2>
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
                          <span className="font-jost text-sm font-light text-ink-3">
                            &mdash; {bd.reason}
                          </span>
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

          {/* Save recurring schedule button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {validationError && tab === 'recurring' && !editingDate && (
              <span className="font-jost text-[12px] font-light text-red-600">
                {validationError}
              </span>
            )}
            {dirty && !validationError && (
              <span className="font-jost text-[12px] font-light text-amber-600">
                Unsaved changes
              </span>
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
        </>
      )}
    </div>
  );
}
