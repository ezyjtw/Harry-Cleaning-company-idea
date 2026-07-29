'use client';

import { signOut } from 'next-auth/react';
import { useState, useCallback, useEffect, useMemo } from 'react';

import RecurringAgreementsCard from '@/components/RecurringAgreementsCard';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import { recordNav } from '@/lib/nav/nav-trace';

interface TimeSlot {
  start: string;
  end: string;
  // R1-A: "Open to regular clients" — lets customers book this weekly slot as
  // a standing weekly/fortnightly clean.
  recurringEligible?: boolean;
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

// F19 (James-ruled final structure): three pills. PRESERVATION LAW — the
// internal keys 'week' and 'recurring' are UNCHANGED (only display labels
// were retitled); 'repeat' is additive. ?tab= deep-links are new with F19
// (the audit found zero pre-existing ones), and unknown values fall through
// to the default, never a dead tab.
type Tab = 'week' | 'recurring' | 'repeat';

export default function AvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('week');

  // F27 root cause: the ?tab= read used to live in the useState INITIALIZER,
  // which runs during render — on a client-side navigation that's BEFORE
  // Next.js commits pushState, so it read the PREVIOUS page's URL and locked
  // onto 'week' while the address bar showed ?tab=repeat. A mount effect runs
  // after the URL commit (the H56 jobs-page pattern, drive-verified).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'recurring' || t === 'repeat' || t === 'week') setTab(t);
  }, []);

  // Recurring weekly template
  const [weeklyRanges, setWeeklyRanges] = useState<Record<DayOfWeek, TimeSlot[]>>(() => {
    const init: Record<string, TimeSlot[]> = {};
    for (const d of daysOfWeek) init[d] = [];
    return init as Record<DayOfWeek, TimeSlot[]>;
  });

  // Date-specific slots from API
  const [dateSlots, setDateSlots] = useState<Record<string, TimeSlot[]>>({});

  const [bookingBuffer, setBookingBuffer] = useState<30 | 60>(30);
  // B1: the buffer saves itself on click. Its old save path was the Recurring
  // tab's "Save Changes" button — invisible from the default Week tab, so the
  // setting silently never persisted for anyone who didn't switch tabs.
  const [bufferState, setBufferState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // H29 (James law): an unsaved-changes guard must ASK, never act silently —
  // and the absence of one silently LOSES edits, which is the same sin. This
  // page tracked dirty state but let any sidebar click discard it without a
  // word. Same interceptor as the profile page.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '/cleaner/availability') return;
      if (
        href.startsWith('/cleaner') ||
        href.startsWith('/messages') ||
        href.startsWith('/disputes') ||
        href === '/'
      ) {
        // eslint-disable-next-line no-alert
        const ok = window.confirm('You have unsaved availability changes. Leave without saving?');
        // H39 trap: every guard consultation leaves a fingerprint — a dead
        // click caused by a leaked stale guard would show here as a blocked
        // consult with no confirm dialog seen by the user.
        recordNav({ kind: 'guard', guard: 'availability-dirty', href, allowed: ok });
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [dirty]);

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

  // R1-C: holiday range — flag regular cleans for the away period.
  const [holidayFrom, setHolidayFrom] = useState('');
  const [holidayTo, setHolidayTo] = useState('');
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidayResult, setHolidayResult] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(false);
    fetch('/api/cleaner/availability')
      .then((res) => {
        if (res.status === 401) {
          // R3: signOut (not router.push) — clears the stale cookie so /login
          // renders instead of middleware bouncing back to /dashboard.
          signOut({ callbackUrl: '/login' });
          return null;
        }
        if (!res.ok) {
          setLoadError(true);
          return null;
        }
        return res.json();
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
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  // A8 (shell only): native pull-to-refresh hook — bumps reloadKey to refetch.
  useEffect(() => {
    if (!/RenaPro/.test(navigator.userAgent)) return;
    const w = window as unknown as { __renaRefresh?: () => void };
    w.__renaRefresh = () => setReloadKey((k) => k + 1);
    return () => {
      delete w.__renaRefresh;
    };
  }, []);

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

  // F19: the regulars room. One flag, several doors — the per-day toggles and
  // the bulk action write the SAME recurringEligible flag the L2 day-sheet
  // checkbox writes, saved immediately via the same PUT (explicit flags, so
  // the f4d644b preservation rules see a deliberate choice every time).
  const anyRegularFlags = daysOfWeek.some((d) => weeklyRanges[d].some((r) => r.recurringEligible));
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('rena.regularsNudgeDismissed') === '1';
  });
  const dismissNudge = () => {
    setNudgeDismissed(true);
    try {
      window.localStorage.setItem('rena.regularsNudgeDismissed', '1');
    } catch {
      /* storage unavailable — dismissal lasts the session */
    }
  };
  const [flagsSaving, setFlagsSaving] = useState(false);
  const [firstTickSeen, setFirstTickSeen] = useState(false);

  // F20 items 1+2: each day exposes a regulars WINDOW (which hours of the day
  // are open to regular clients), edited locally and committed by an explicit
  // Save — one PUT, explicit flags (f4d644b explicit-wins). Saving rides the
  // existing per-range machinery: the day's working block is split into
  // flagged/unflagged ranges, so eligibility, the offer service and the L2
  // day-sheet all keep reading the same rows.
  type RepeatWindow = { open: boolean; from: string; to: string };
  const [repeatDraft, setRepeatDraft] = useState<Record<DayOfWeek, RepeatWindow | null> | null>(
    null
  );
  const [repeatDirty, setRepeatDirty] = useState(false);
  const [repeatErrors, setRepeatErrors] = useState<Record<string, string>>({});

  const mergedBlocks = (ranges: TimeSlot[]): { start: string; end: string }[] => {
    const sorted = [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    const blocks: { start: string; end: string }[] = [];
    for (const r of sorted) {
      const last = blocks[blocks.length - 1];
      if (last && timeToMinutes(r.start) <= timeToMinutes(last.end)) {
        if (timeToMinutes(r.end) > timeToMinutes(last.end)) last.end = r.end;
      } else {
        blocks.push({ start: r.start, end: r.end });
      }
    }
    return blocks;
  };
  const biggestBlock = (blocks: { start: string; end: string }[]) =>
    blocks.reduce((a, b) =>
      timeToMinutes(b.end) - timeToMinutes(b.start) > timeToMinutes(a.end) - timeToMinutes(a.start)
        ? b
        : a
    );

  // Derive the draft from saved state whenever there are no local edits.
  useEffect(() => {
    if (repeatDirty) return;
    const d = {} as Record<DayOfWeek, RepeatWindow | null>;
    for (const day of daysOfWeek) {
      const blocks = mergedBlocks(weeklyRanges[day]);
      if (blocks.length === 0) {
        d[day] = null;
        continue;
      }
      const flagged = weeklyRanges[day].filter((r) => r.recurringEligible);
      const big = biggestBlock(blocks);
      if (flagged.length === 0) {
        d[day] = { open: false, from: big.start, to: big.end };
      } else {
        const from = flagged.reduce((m, r) => (r.start < m ? r.start : m), flagged[0].start);
        const to = flagged.reduce((m, r) => (r.end > m ? r.end : m), flagged[0].end);
        d[day] = { open: true, from, to };
      }
    }
    setRepeatDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyRanges, repeatDirty]);

  const editRepeatDay = (day: DayOfWeek, patch: Partial<RepeatWindow>) => {
    setRepeatDraft((prev) => {
      const current = prev?.[day];
      return prev && current ? { ...prev, [day]: { ...current, ...patch } } : prev;
    });
    setRepeatDirty(true);
    setRepeatErrors({});
  };
  // Bulk action: draft every scheduled day's FULL hours open — applied on Save.
  const openAllRegulars = () => {
    setRepeatDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const day of daysOfWeek) {
        const blocks = mergedBlocks(weeklyRanges[day]);
        if (blocks.length > 0) {
          const big = biggestBlock(blocks);
          next[day] = { open: true, from: big.start, to: big.end };
        }
      }
      return next;
    });
    setRepeatDirty(true);
    setRepeatErrors({});
  };

  const saveRepeat = async () => {
    if (!repeatDraft || flagsSaving) return;
    // Item 1 law: the window must sit WITHIN the day's working hours — honest
    // inline error, never a silent clamp.
    const errors: Record<string, string> = {};
    for (const day of daysOfWeek) {
      const w = repeatDraft[day];
      if (!w || !w.open) continue;
      if (timeToMinutes(w.to) - timeToMinutes(w.from) < 30) {
        errors[day] = 'The regulars window needs at least 30 minutes.';
        continue;
      }
      const blocks = mergedBlocks(weeklyRanges[day]);
      const host = blocks.find(
        (b) =>
          timeToMinutes(w.from) >= timeToMinutes(b.start) &&
          timeToMinutes(w.to) <= timeToMinutes(b.end)
      );
      if (!host) {
        const hoursList = blocks
          .map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`)
          .join(', ');
        errors[day] = `Regulars hours must sit within your working hours (${hoursList}).`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setRepeatErrors(errors);
      return;
    }
    const hadNone = !anyRegularFlags;
    setFlagsSaving(true);
    try {
      const nextRanges = {} as Record<DayOfWeek, TimeSlot[]>;
      for (const day of daysOfWeek) {
        const blocks = mergedBlocks(weeklyRanges[day]);
        const w = repeatDraft[day];
        const out: TimeSlot[] = [];
        for (const bl of blocks) {
          const hosts =
            !!w &&
            w.open &&
            timeToMinutes(w.from) >= timeToMinutes(bl.start) &&
            timeToMinutes(w.to) <= timeToMinutes(bl.end);
          if (hosts && w) {
            if (timeToMinutes(w.from) > timeToMinutes(bl.start)) {
              out.push({ start: bl.start, end: w.from, recurringEligible: false });
            }
            out.push({ start: w.from, end: w.to, recurringEligible: true });
            if (timeToMinutes(w.to) < timeToMinutes(bl.end)) {
              out.push({ start: w.to, end: bl.end, recurringEligible: false });
            }
          } else {
            out.push({ start: bl.start, end: bl.end, recurringEligible: false });
          }
        }
        nextRanges[day] = out;
      }
      const weeklySlots: Record<string, TimeSlot[]> = {};
      for (const d of daysOfWeek) weeklySlots[dayToApi[d]] = nextRanges[d];
      const res = await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklySlots }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRepeatErrors({
          _global: (data as { error?: string }).error || 'Could not save — try again.',
        });
        return;
      }
      setWeeklyRanges(nextRanges);
      setRepeatDirty(false);
      // Item 2: the first-tick confirmation fires ON SAVE, when flags first go on.
      if (hadNone && daysOfWeek.some((d) => nextRanges[d].some((r) => r.recurringEligible))) {
        setFirstTickSeen(true);
      }
    } finally {
      setFlagsSaving(false);
    }
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

  // ── Buffer: immediate partial save (B1) ────────────
  const handleBufferChange = useCallback(
    async (mins: 30 | 60) => {
      const prev = bookingBuffer;
      if (prev === mins) return;
      setBookingBuffer(mins);
      setBufferState('saving');
      try {
        const res = await fetch('/api/cleaner/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingBufferMinutes: mins }),
        });
        if (!res.ok) throw new Error('save failed');
        setBufferState('saved');
        setTimeout(() => setBufferState('idle'), 3000);
      } catch {
        setBookingBuffer(prev);
        setBufferState('error');
      }
    },
    [bookingBuffer]
  );

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

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <h2 className="font-newsreader text-lg font-semibold text-ink">
            Couldn&apos;t load your availability
          </h2>
          <p className="mt-1 font-jost text-sm text-ink-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
          >
            Retry
          </button>
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
        className="flex gap-1 mb-6 rounded-lg bg-primary-soft p-1"
        style={{ border: '1px solid rgb(var(--color-border))' }}
      >
        <button
          onClick={() => setTab('week')}
          className={`flex-1 rounded-md px-3 py-2 font-jost text-sm transition-all ${
            tab === 'week'
              ? 'bg-surface text-ink shadow-sm font-normal'
              : 'text-ink-3 font-light hover:text-ink'
          }`}
        >
          This week
        </button>
        <button
          onClick={() => setTab('recurring')}
          className={`flex-1 rounded-md px-3 py-2 font-jost text-sm transition-all ${
            tab === 'recurring'
              ? 'bg-surface text-ink shadow-sm font-normal'
              : 'text-ink-3 font-light hover:text-ink'
          }`}
        >
          Recurring schedule
        </button>
        <button
          onClick={() => setTab('repeat')}
          className={`flex-1 rounded-md px-3 py-2 font-jost text-sm transition-all ${
            tab === 'repeat'
              ? 'bg-surface text-ink shadow-sm font-normal'
              : 'text-ink-3 font-light hover:text-ink'
          }`}
        >
          Repeat bookings
        </button>
      </div>

      {/* Same-day bookings toggle */}
      {SAME_DAY_FEATURE_ENABLED && (
        <div
          className="rounded-xl bg-surface p-5 mb-6"
          style={{ border: '1px solid rgb(var(--color-border))' }}
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
                sameDayBookings ? 'bg-primary' : 'bg-ink-3/30'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                  sameDayBookings ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Buffer between bookings */}
      <div
        className="rounded-xl bg-surface overflow-hidden mb-6"
        style={{ border: '1px solid rgb(var(--color-border))' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgb(var(--color-border))' }}>
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
                onClick={() => handleBufferChange(mins)}
                disabled={bufferState === 'saving'}
                className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                  bookingBuffer === mins
                    ? 'bg-primary/5 text-ink ring-2 ring-primary shadow-sm'
                    : 'bg-page text-ink-2 ring-ink/[0.06] hover:bg-primary-soft hover:text-ink hover:shadow-sm'
                }`}
              >
                {mins === 30 ? '30 minutes' : '1 hour'}
              </button>
            ))}
          </div>
          <p className="mt-3 font-jost text-xs font-light text-ink-3">
            A {bookingBuffer}-minute buffer will be blocked before and after each booking so you
            have time to travel and prepare.
            {bufferState === 'saving' && <span className="ml-2 text-ink-2">Saving…</span>}
            {bufferState === 'saved' && <span className="ml-2 text-success">Saved</span>}
            {bufferState === 'error' && (
              <span className="ml-2 text-danger">Couldn&apos;t save — please try again.</span>
            )}
          </p>
        </div>
      </div>

      {/* ─── WEEK VIEW TAB ─────────────────────────────── */}
      {tab === 'week' && (
        <>
          {/* F19 nudge: zero-flags only, one dismissal is permanent (localStorage). */}
          {!anyRegularFlags && !nudgeDismissed && !loading && (
            <div
              className="mb-6 flex items-start justify-between gap-3 rounded-xl bg-primary-soft p-4"
              style={{ border: '1px solid rgb(var(--color-border))' }}
              data-testid="regulars-nudge"
            >
              <div className="min-w-0">
                <p className="font-jost text-sm text-ink">
                  None of your slots are open to regular clients yet.
                </p>
                <p className="mt-0.5 font-jost text-[13px] font-light text-ink-2">
                  Regulars mean the same customer in the same slot every week — guaranteed income,
                  no chasing jobs.
                </p>
                <button
                  onClick={() => setTab('repeat')}
                  className="mt-2 rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Open slots to regulars
                </button>
              </div>
              <button
                onClick={dismissNudge}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg p-1.5 text-ink-3 transition hover:bg-page hover:text-ink"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setWeekOffset((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
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
                  className="font-jost text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/70 transition"
                >
                  Go to this week
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-3/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
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
              className="rounded-full px-4 py-1.5 bg-primary text-white font-jost text-[11px] uppercase tracking-[0.1em] hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {lockingIn ? 'Locking in…' : 'Lock in this week'}
            </button>
          </div>
          {lockInResult && (
            <p className="mb-4 font-jost text-xs font-light text-trust">{lockInResult}</p>
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
                  className={`rounded-xl bg-surface overflow-hidden transition-all ${
                    isEditing ? 'ring-2 ring-primary shadow-md' : ''
                  }`}
                  style={{ border: '1px solid rgb(var(--color-border))' }}
                >
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-center min-w-[44px] ${isPast ? 'opacity-40' : ''}`}>
                        <p className="font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3">
                          {dayName.slice(0, 3)}
                        </p>
                        <p
                          className={`font-newsreader text-lg font-medium ${isToday ? 'text-primary' : 'text-ink'}`}
                        >
                          {new Date(`${dateStr}T12:00:00`).getDate()}
                        </p>
                      </div>

                      {blocked ? (
                        <span className="font-jost text-xs font-light text-danger">Blocked</span>
                      ) : isDateSpecific ? (
                        <span className="font-jost text-[10px] uppercase tracking-[0.1em] text-primary">
                          Custom day
                        </span>
                      ) : null}
                      {/* F19: ●R — this weekday's template has regular-open slot(s). */}
                      {!blocked &&
                        !isDateSpecific &&
                        weeklyRanges[dayName as DayOfWeek]?.some((r) => r.recurringEligible) && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-jost text-[11px] font-medium text-primary"
                            data-testid="regular-open-marker"
                          >
                            ●R Regulars
                          </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                      {slots.length > 0 && !blocked && (
                        <span className="font-jost text-xs font-light text-ink-3">{dayHours}h</span>
                      )}
                      {!isPast && !isEditing && (
                        <div className="flex flex-wrap gap-1.5">
                          {/* X7: 44px labelled touch targets — hover tooltips die. */}
                          <button
                            onClick={() => openDayEditor(dateStr, dayName)}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-line px-3 font-jost text-[12px] font-medium text-ink-2 hover:bg-page transition"
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
                            Edit
                          </button>
                          {blocked ? (
                            <button
                              onClick={() => unblockDate(dateStr)}
                              className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-danger/30 px-3 font-jost text-[12px] font-medium text-danger hover:bg-danger/10 transition"
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
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => blockDate(dateStr)}
                              className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-line px-3 font-jost text-[12px] font-medium text-ink-2 hover:bg-danger/10 hover:text-danger transition"
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
                              Block
                            </button>
                          )}
                          {isDateSpecific && (
                            <button
                              onClick={() => revertToRecurring(dateStr)}
                              className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-line px-3 font-jost text-[12px] font-medium text-ink-2 hover:bg-page transition"
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
                              Revert
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* A1 timeline: a 6am–midnight track with the day's window(s)
                      as navy blocks (times inside). Tapping it opens the SAME
                      editor as the pencil — purely a visual read of the same data. */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => !isPast && openDayEditor(dateStr, dayName)}
                      disabled={isPast || blocked}
                      className="block w-full px-5 pb-4 text-left disabled:cursor-default"
                      aria-label={`Edit ${dayName} availability`}
                    >
                      <div className="relative h-7 overflow-hidden rounded-md bg-page ring-1 ring-line">
                        {blocked ? (
                          <span className="absolute inset-0 flex items-center justify-center font-jost text-[11px] font-light text-danger">
                            Blocked
                          </span>
                        ) : slots.length === 0 ? (
                          <span className="absolute inset-0 flex items-center justify-center font-jost text-[11px] font-light text-ink-3">
                            Not available
                          </span>
                        ) : (
                          slots.map((s, i) => {
                            const startM = Math.max(360, timeToMinutes(s.start));
                            const endM = Math.min(1440, timeToMinutes(s.end));
                            const left = ((startM - 360) / 1080) * 100;
                            const width = Math.max(1, ((endM - startM) / 1080) * 100);
                            return (
                              <span
                                key={i}
                                className="absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-md bg-primary px-1"
                                style={{ left: `${left}%`, width: `${width}%` }}
                              >
                                <span className="truncate font-jost text-[10px] font-medium text-white">
                                  {formatTime(s.start)}–{formatTime(s.end)}
                                </span>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-1 flex justify-between font-jost text-[9px] uppercase tracking-[0.08em] text-ink-3">
                        <span>6a</span>
                        <span>12p</span>
                        <span>6p</span>
                        <span>12a</span>
                      </div>
                    </button>
                  )}

                  {/* Inline day editor */}
                  {isEditing && (
                    <div
                      className="px-5 pb-4 pt-1"
                      style={{ borderTop: '1px solid rgb(var(--color-border))' }}
                    >
                      {copyOnEditNotice && (
                        <div className="mb-3 rounded-lg bg-primary/5 p-3 ring-1 ring-primary/20">
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
                              className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                              className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {formatTime(t)}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeEditingSlot(idx)}
                              className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-page transition"
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
                          className="font-jost text-xs font-light text-primary hover:text-primary/70 transition flex items-center gap-1"
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
                        <p className="mt-2 font-jost text-[12px] font-light text-danger">
                          {validationError}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={saveDateSlots}
                          disabled={editingSaving}
                          className="rounded-full px-5 py-1.5 bg-primary text-white font-jost text-[12px] font-light hover:bg-primary-hover disabled:opacity-50 transition-colors"
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
            className="rounded-xl bg-surface p-5 mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
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
                  alwaysAvailable ? 'bg-primary' : 'bg-ink-3/30'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                    alwaysAvailable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Always Available config modal */}
            {showAlwaysConfig && (
              <div className="mt-4 rounded-lg bg-page p-4 ring-1 ring-ink/[0.06]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-jost text-xs font-normal text-ink mb-2">
                      Weekday hours (Mon–Fri)
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={weekdayHours.start}
                        onChange={(e) => setWeekdayHours((p) => ({ ...p, start: e.target.value }))}
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-surface ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-surface ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-surface ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                        className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-surface ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    className="rounded-full px-5 py-1.5 bg-primary text-white font-jost text-[12px] font-light hover:bg-primary-hover transition-colors"
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
            className="rounded-xl bg-surface overflow-hidden mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
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
                            enabled ? 'bg-primary' : 'bg-ink-3/30'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
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
                              className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                              className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                              className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-page transition"
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
                            {/* F19: the "Open to regular clients" control moved
                                to the Repeat bookings pill (regulars-specific);
                                a quiet ●R still marks flagged ranges here. */}
                            {range.recurringEligible && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-jost text-[11px] font-medium text-primary">
                                ●R
                              </span>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addRange(day)}
                          className="font-jost text-xs font-light text-primary hover:text-primary/70 transition flex items-center gap-1"
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

          {/* F19: RecurringAgreementsCard and the "Going away?" holiday card
              MOVED to the Repeat bookings pill (regulars-specific content). */}

          {/* Blocked dates */}
          <div
            className="rounded-xl bg-surface overflow-hidden mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
            >
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
                        className="flex items-center justify-between rounded-lg bg-page px-4 py-2.5"
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
                    className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    style={{ border: '1px solid rgb(var(--color-border))' }}
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
                    className="rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    style={{ border: '1px solid rgb(var(--color-border))' }}
                  />
                </div>
                <button
                  onClick={addBlockedDate}
                  disabled={!newBlockDate}
                  className="rounded-full px-5 py-2 bg-primary text-white font-jost text-[13px] font-light hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  Block Date
                </button>
              </div>
            </div>
          </div>

          {/* Save recurring schedule button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {validationError && tab === 'recurring' && !editingDate && (
              <span className="font-jost text-[12px] font-light text-danger">
                {validationError}
              </span>
            )}
            {dirty && !validationError && (
              <span className="font-jost text-[12px] font-light text-warning">Unsaved changes</span>
            )}
            {saved && (
              <span className="font-jost text-sm font-light text-trust flex items-center gap-1">
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
              className="rounded-full px-8 py-2.5 bg-primary text-white font-jost text-[13px] font-light shadow-sm hover:bg-primary-hover transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </>
      )}

      {/* ─── REPEAT BOOKINGS TAB (F19) — the regulars room ─────────────── */}
      {tab === 'repeat' && (
        <>
          {/* Proposition header */}
          <div
            className="rounded-xl bg-primary-soft p-6 mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Repeat bookings
            </p>
            <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
              Open your slots to regular weekly clients
            </h2>
            <p className="mt-1 font-jost text-sm font-light text-ink-2">
              Same customer, same slot, every week. Guaranteed income, no chasing jobs.
            </p>
            <button
              onClick={openAllRegulars}
              disabled={flagsSaving || loading}
              className="mt-4 rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              data-testid="open-all-regulars"
            >
              Open all my slots to regulars
            </button>
            <p className="mt-2 font-jost text-[12px] font-light text-ink-3">
              Opens each day&rsquo;s full working hours — narrow any day below, then save.
            </p>
            {firstTickSeen && (
              <p className="mt-3 font-jost text-sm text-trust" data-testid="first-tick-line">
                Saved — customers can now ask to make these slots their regular clean. You approve
                each arrangement, and you can close a slot again any time.
              </p>
            )}
          </div>

          {/* F20 item 1: per-day WINDOWS — which hours of each day are open to
              regulars. Same recurringEligible flag as the app's day-sheet
              checkbox (saving splits the working block into flagged/unflagged
              ranges). Edits are local until Save Changes below (item 2). */}
          <div
            className="rounded-xl bg-surface overflow-hidden mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
            >
              <h2 className="font-newsreader text-lg font-semibold text-ink">
                Which hours are open to regulars?
              </h2>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
                Per day — the window must sit within your working hours
              </p>
            </div>
            <div className="divide-y divide-ink/[0.04]">
              {daysOfWeek.map((day) => {
                const blocks = mergedBlocks(weeklyRanges[day]);
                const hasHours = blocks.length > 0;
                const w = repeatDraft?.[day] ?? null;
                return (
                  <div key={day} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`font-jost text-sm ${hasHours ? 'font-normal text-ink' : 'font-light text-ink-3'}`}
                        >
                          {day}
                        </p>
                        <p className="font-jost text-xs font-light text-ink-3">
                          {hasHours
                            ? `Works ${blocks
                                .map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`)
                                .join(' · ')}`
                            : 'Not on your weekly schedule'}
                        </p>
                      </div>
                      <button
                        onClick={() => w && editRepeatDay(day, { open: !w.open })}
                        disabled={!hasHours || flagsSaving}
                        data-testid={`regulars-toggle-${day.toLowerCase()}`}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                          w?.open ? 'bg-primary' : 'bg-ink-3/30'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                            w?.open ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {w?.open && (
                      <div className="mt-2.5 flex items-center gap-2 sm:ml-1">
                        <span className="font-jost text-xs font-light text-ink-3">
                          Open to regulars
                        </span>
                        <select
                          value={w.from}
                          onChange={(e) => editRepeatDay(day, { from: e.target.value })}
                          data-testid={`regulars-from-${day.toLowerCase()}`}
                          className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {formatTime(t)}
                            </option>
                          ))}
                        </select>
                        <span className="font-jost text-xs text-ink-3">to</span>
                        <select
                          value={w.to}
                          onChange={(e) => editRepeatDay(day, { to: e.target.value })}
                          data-testid={`regulars-to-${day.toLowerCase()}`}
                          className="rounded-lg px-2 py-1.5 font-jost text-sm font-light text-ink bg-page ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {formatTime(t)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {repeatErrors[day] && (
                      <p
                        className="mt-2 font-jost text-[12px] text-danger"
                        data-testid={`regulars-error-${day.toLowerCase()}`}
                      >
                        {repeatErrors[day]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* F20 item 2: explicit save — one write, matching the Recurring
              schedule tab's model. */}
          <div className="flex items-center justify-end gap-3 mb-6">
            {repeatErrors._global && (
              <span className="font-jost text-[12px] font-light text-danger">
                {repeatErrors._global}
              </span>
            )}
            {repeatDirty && Object.keys(repeatErrors).length === 0 && (
              <span className="font-jost text-[12px] font-light text-warning">Unsaved changes</span>
            )}
            <button
              onClick={saveRepeat}
              disabled={flagsSaving || !repeatDirty}
              data-testid="repeat-save"
              className="rounded-full px-8 py-2.5 bg-primary text-white font-jost text-[13px] font-light shadow-sm hover:bg-primary-hover transition disabled:opacity-50"
            >
              {flagsSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* R1-A: standing regular clients — renders only when one exists.
              (F19: moved here from the Recurring schedule tab.) */}
          <RecurringAgreementsCard role="CLEANER" className="mb-6" />

          {/* R1-C: holiday — flag every regular clean in a range at once. Each
              affected customer chooses per clean; arrangements are unchanged.
              (F19: moved here — regulars-specific. Does NOT block the dates;
              use Blocked Dates on Recurring schedule for that.) */}
          <div
            className="rounded-xl bg-surface overflow-hidden mb-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
            >
              <h2 className="font-newsreader text-lg font-semibold text-ink">Going away?</h2>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-0.5">
                Flag your regular cleans in a date range — your customers choose per clean
              </p>
            </div>
            <div className="px-6 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="font-jost text-sm text-ink-2">
                  From
                  <input
                    type="date"
                    value={holidayFrom}
                    onChange={(e) => setHolidayFrom(e.target.value)}
                    className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06]"
                  />
                </label>
                <label className="font-jost text-sm text-ink-2">
                  To
                  <input
                    type="date"
                    value={holidayTo}
                    onChange={(e) => setHolidayTo(e.target.value)}
                    className="mt-1 block rounded-lg px-3 py-2 font-jost text-sm text-ink bg-page ring-1 ring-ink/[0.06]"
                  />
                </label>
                <button
                  type="button"
                  disabled={holidayBusy || !holidayFrom || !holidayTo}
                  onClick={async () => {
                    setHolidayBusy(true);
                    setHolidayResult(null);
                    try {
                      const res = await fetch('/api/cleaner/occurrences/holiday', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ startDate: holidayFrom, endDate: holidayTo }),
                      });
                      const data = await res.json().catch(() => null);
                      setHolidayResult(
                        res.ok ? data?.message || 'Done.' : data?.error || 'Something went wrong.'
                      );
                    } catch {
                      setHolidayResult('Network error — please try again.');
                    } finally {
                      setHolidayBusy(false);
                    }
                  }}
                  className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {holidayBusy ? 'Flagging…' : 'Flag my regular cleans'}
                </button>
              </div>
              {holidayResult && (
                <p className="mt-2 font-jost text-sm text-ink-2">{holidayResult}</p>
              )}
              <p className="mt-2 font-jost text-[12px] font-light text-ink-3">
                Paid cleans offer your customer a reschedule, cover, or a full refund; uncharged
                ones offer a new date or a free skip. The dates are also blocked in your
                availability automatically — unblock them any time under Blocked Dates.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
