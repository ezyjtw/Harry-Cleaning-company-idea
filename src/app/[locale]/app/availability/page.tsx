'use client';

// C2: the Rena Pro Availability screen (L2). Same APIs as the portal page —
// GET/PUT /api/cleaner/availability, POST/DELETE /api/cleaner/availability/date-slots
// — the portal page is untouched. Served only inside the shell (/app layout gate).
//
// P2 (James-ruled, App Review Batch 1): "Your Week Ahead" is the front page —
// seven rows pre-filled from usual hours, toggles flip days off, tap a time →
// the sheet (chips + native wheels in 30-min steps). Changes STAGE locally and
// commit together on "Set My Week". Usual hours demotes to a secondary card,
// edited with the same sheet (immediate save — it's the standing template).
// The drag-slider editor is retired. Same endpoints as before — no booking
// mechanics touched.

import { useCallback, useEffect, useMemo, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';
import { haptic } from '@/components/app/job-cards';

interface TimeSlot {
  start: string;
  end: string;
  // F18: "Open to regular clients" — rides the same GET/PUT payload as the
  // portal page. Absent on date-slots (that API has no flag). Opt-in stays
  // the cleaner's choice; this screen just finally exposes the switch.
  recurringEligible?: boolean;
}
interface BlockedDate {
  date: string;
  reason: string;
}

type ApiDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const API_DAYS: ApiDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const DAY_LABEL: Record<ApiDay, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
const JS_DAY_TO_API: ApiDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// The bookable day: 06:00 → 24:00 in 30-min steps (matches the portal timeline).
const TRACK_START = 6 * 60;
const TRACK_END = 24 * 60;
const SNAP = 30;

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(mins: number): string {
  const m = Math.min(Math.max(mins, 0), 23 * 60 + 59);
  // The API's day ends at 23:59 (validated HH:mm); the wheels treat it as 24:00.
  if (m >= TRACK_END - 1) return '23:59';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function trackMin(t: string): number {
  // 23:59 counts as the 24:00 end of the day.
  const m = toMin(t);
  return m === 23 * 60 + 59 ? TRACK_END : m;
}
function fmt(t: string): string {
  if (t === '23:59') return '12am';
  const [hS, mS] = t.split(':');
  const h = parseInt(hS, 10);
  const suffix = h < 12 ? 'am' : 'pm';
  const disp = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return mS === '00' ? `${disp}${suffix}` : `${disp}:${mS}${suffix}`;
}
// Readback voice ("Done — free 8:30–11:30 & 1:00–3:00") — James's exact format.
function wordTime(t: string): string {
  if (t === '23:59') return '12:00';
  const [hS, mS] = t.split(':');
  let h = parseInt(hS, 10) % 12;
  if (h === 0) h = 12;
  return `${h}:${mS}`;
}
function wordRanges(ranges: TimeSlot[]): string {
  return ranges.map((r) => `${wordTime(r.start)}–${wordTime(r.end)}`).join(' & ');
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
function hoursOf(ranges: TimeSlot[]): number {
  return ranges.reduce((s, r) => s + (trackMin(r.end) - toMin(r.start)) / 60, 0);
}
function hrsStr(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}
function rangesEqual(a: TimeSlot[], b: TimeSlot[]): boolean {
  if (a.length !== b.length) return false;
  const key = (rs: TimeSlot[]) =>
    [...rs]
      .sort((x, y) => toMin(x.start) - toMin(y.start))
      .map((r) => `${r.start}-${r.end}`)
      .join(',');
  return key(a) === key(b);
}

function validateRanges(ranges: TimeSlot[]): string | null {
  for (const r of ranges) {
    if (toMin(r.start) >= trackMin(r.end)) return 'Start must be before end';
    if (trackMin(r.end) - toMin(r.start) < SNAP) return 'Each range needs at least 30 minutes';
  }
  const sorted = [...ranges].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMin(sorted[i].start) < trackMin(sorted[i - 1].end)) return 'Ranges overlap';
  }
  return null;
}

// Row voice: ≤2 ranges printed in full, 3+ compressed (James-ruled).
function rowText(ranges: TimeSlot[]): string {
  if (ranges.length === 0) return 'Off';
  if (ranges.length <= 2) return ranges.map((r) => `${fmt(r.start)}–${fmt(r.end)}`).join(' & ');
  return `${ranges.length} times · ${hrsStr(hoursOf(ranges))} hrs`;
}

// ── Native time wheels (30-min steps) ─────────────────────────────────────────
// Plain <select>s: iOS renders them as native wheel pickers inside the WebView,
// which is exactly the ruled control. 06:00 → 24:00 in 30-min steps.
const START_OPTIONS: string[] = [];
for (let m = TRACK_START; m < TRACK_END; m += SNAP) START_OPTIONS.push(toTime(m));
const END_OPTIONS: string[] = [];
for (let m = TRACK_START + SNAP; m <= TRACK_END; m += SNAP)
  END_OPTIONS.push(m >= TRACK_END ? '23:59' : toTime(m));

function TimeWheel({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => {
        haptic('light');
        onChange(e.target.value);
      }}
      className="rounded-[10px] border border-line bg-surface px-3 py-2.5 text-center font-jost text-[15px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {fmt(t)}
        </option>
      ))}
    </select>
  );
}

// ── Bottom sheet chrome ────────────────────────────────────────────────────────
function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-jost text-lg font-semibold text-ink">{title}</p>
            {subtitle && <p className="mt-0.5 font-jost text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-line p-2 text-ink-3 active:bg-page"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Editing target: a specific date (staged into the week plan) or a weekday
// template (saved immediately — it's the standing usual).
type EditTarget = { kind: 'date'; date: string; day: ApiDay } | { kind: 'day'; day: ApiDay };

// The staged shape of one Week-Ahead day.
interface DayPlan {
  off: boolean;
  ranges: TimeSlot[];
}

export default function AvailabilityAppPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [weekly, setWeekly] = useState<Record<ApiDay, TimeSlot[]>>(() => {
    const init = {} as Record<ApiDay, TimeSlot[]>;
    for (const d of API_DAYS) init[d] = [];
    return init;
  });
  const [dateSlots, setDateSlots] = useState<Record<string, TimeSlot[]>>({});
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);

  // P2 staging: touched Week-Ahead days, keyed by ISO date. Committed as one
  // batch by "Set My Week"; cleared on every fresh fetch.
  const [plan, setPlan] = useState<Record<string, DayPlan>>({});
  const [weekSaving, setWeekSaving] = useState(false);

  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // "Done — free 8:30–11:30 & 1:00–3:00" (James's exact readback voice).
  const [doneFlash, setDoneFlash] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showCalendar, setShowCalendar] = useState(false);

  // W6: time off + the two settings rows (buffer, same-day).
  const [buffer, setBuffer] = useState<30 | 60>(30);
  const [sameDay, setSameDay] = useState(true);
  const [settingBusy, setSettingBusy] = useState<'buffer' | 'sameDay' | null>(null);

  const fetchAll = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/cleaner/availability');
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        setLoadError(true);
        return;
      }
      const next = {} as Record<ApiDay, TimeSlot[]>;
      for (const d of API_DAYS) next[d] = data.weeklySlots?.[d] || [];
      setWeekly(next);
      setDateSlots(data.dateSlots || {});
      setBlocked(data.blockedDates || []);
      setPlan({});
      // W6: the two settings rows read the same GET; saves are per-field PUTs.
      setSameDay(data.availableNow ?? true);
      setBuffer(data.bookingBufferMinutes === 60 ? 60 : 30);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Native shell pull-to-refresh hook (same contract as the other /app screens).
  useEffect(() => {
    const w = window as unknown as { __renaRefresh?: () => void };
    w.__renaRefresh = fetchAll;
    return () => {
      delete w.__renaRefresh;
    };
  }, [fetchAll]);

  // PUT only what this screen edits (weekly + blocked). Settings this screen
  // has no UI for (availableNow, bookingBufferMinutes) are deliberately NOT
  // sent — the API treats absent fields as untouched, and echoing them back
  // from a stale snapshot could clobber a value saved elsewhere (B1).
  const putAll = useCallback(
    async (weeklyNext: Record<ApiDay, TimeSlot[]>, blockedNext: BlockedDate[]) => {
      setSaveError(null);
      const res = await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklySlots: weeklyNext,
          blockedDates: blockedNext,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Could not save');
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
    []
  );

  const commit = useCallback(
    async (weeklyNext: Record<ApiDay, TimeSlot[]>, blockedNext: BlockedDate[]) => {
      const prevWeekly = weekly;
      const prevBlocked = blocked;
      setWeekly(weeklyNext);
      setBlocked(blockedNext);
      try {
        await putAll(weeklyNext, blockedNext);
        haptic('success');
        return true;
      } catch (err) {
        setWeekly(prevWeekly);
        setBlocked(prevBlocked);
        haptic('error');
        setSaveError(err instanceof Error ? err.message : 'Could not save');
        return false;
      }
    },
    [weekly, blocked, putAll]
  );

  // ── Week Ahead data: the next 7 days, baseline from DB, overlay from plan ──
  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = isoOf(d);
      const day = JS_DAY_TO_API[d.getDay()];
      const isBlocked = blocked.some((b) => b.date === iso);
      const custom = (dateSlots[iso]?.length ?? 0) > 0;
      const baseline: DayPlan = {
        off: isBlocked,
        ranges: custom ? dateSlots[iso] : weekly[day],
      };
      const eff = plan[iso] ?? baseline;
      return {
        iso,
        day,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_LABEL[day],
        dateShort: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        baseline,
        eff,
        // Tinted = this day differs from the usual template (James: "tweaked
        // days tinted") — whether saved as a date-slot or freshly staged.
        tweaked: !eff.off && !rangesEqual(eff.ranges, weekly[day]),
        dirty: eff.off !== baseline.off || !rangesEqual(eff.ranges, baseline.ranges),
      };
    });
  }, [blocked, dateSlots, weekly, plan]);

  const weekDirty = week.some((d) => d.dirty);
  const weekHoursOpen = week.reduce((s, d) => s + (d.eff.off ? 0 : hoursOf(d.eff.ranges)), 0);

  const weeklyHours = useMemo(
    () => API_DAYS.reduce((sum, d) => sum + hoursOf(weekly[d]), 0),
    [weekly]
  );

  // ── Week Ahead interactions (all staged) ──
  const toggleWeekDay = (iso: string) => {
    haptic('light');
    setDoneFlash(null);
    const d = week.find((w) => w.iso === iso);
    if (!d) return;
    if (d.eff.off) {
      const ranges = d.eff.ranges.length
        ? d.eff.ranges
        : weekly[d.day].length
          ? weekly[d.day].map((s) => ({ ...s }))
          : [{ start: '09:00', end: '17:00' }];
      setPlan((p) => ({ ...p, [iso]: { off: false, ranges } }));
    } else {
      setPlan((p) => ({ ...p, [iso]: { off: true, ranges: d.eff.ranges } }));
    }
  };

  const openDate = (iso: string, day: ApiDay) => {
    haptic('light');
    const d = week.find((w) => w.iso === iso);
    const slots = (d && d.eff.ranges.length ? d.eff.ranges : weekly[day]).map((s) => ({ ...s }));
    setEditSlots(slots.length ? slots : [{ start: '09:00', end: '17:00' }]);
    setEditError(null);
    setDoneFlash(null);
    setEditing({ kind: 'date', date: iso, day });
  };
  const openDay = (day: ApiDay) => {
    haptic('light');
    const slots = weekly[day].map((s) => ({ ...s }));
    setEditSlots(slots.length ? slots : [{ start: '09:00', end: '17:00' }]);
    setEditError(null);
    setDoneFlash(null);
    setEditing({ kind: 'day', day });
  };

  // Sheet Done: date edits stage into the plan; day (usual) edits save now.
  const saveSheet = async () => {
    if (!editing) return;
    const err = validateRanges(editSlots);
    if (err) {
      setEditError(err);
      return;
    }
    if (editing.kind === 'date') {
      setPlan((p) => ({
        ...p,
        [editing.date]: { off: false, ranges: editSlots.map((s) => ({ ...s })) },
      }));
      haptic('success');
      setDoneFlash(`Done — free ${wordRanges(editSlots)}`);
      setEditing(null);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const ok = await commit({ ...weekly, [editing.day]: editSlots }, blocked);
      if (!ok) {
        setEditError('Could not save — try again');
        return;
      }
      setDoneFlash(`Done — free ${wordRanges(editSlots)}`);
      setEditing(null);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Set My Week: commit every staged day through the existing endpoints ──
  const setMyWeek = async () => {
    if (!weekDirty || weekSaving) return;
    haptic('medium');
    setWeekSaving(true);
    setSaveError(null);
    setDoneFlash(null);
    try {
      // 1) Blocked-date changes ride one PUT (weekly untouched by this screen).
      let blockedNext = [...blocked];
      let blockedChanged = false;
      for (const d of week) {
        if (!d.dirty) continue;
        const wasBlocked = blocked.some((b) => b.date === d.iso);
        if (d.eff.off && !wasBlocked) {
          blockedNext.push({ date: d.iso, reason: 'Unavailable' });
          blockedChanged = true;
        } else if (!d.eff.off && wasBlocked) {
          blockedNext = blockedNext.filter((b) => b.date !== d.iso);
          blockedChanged = true;
        }
      }
      if (blockedChanged) await putAll(weekly, blockedNext);

      // 2) Per-date overrides: differs from usual → POST; back to usual → DELETE.
      const nextDateSlots = { ...dateSlots };
      for (const d of week) {
        if (!d.dirty || d.eff.off) continue;
        const sameAsUsual = rangesEqual(d.eff.ranges, weekly[d.day]);
        const hadCustom = (dateSlots[d.iso]?.length ?? 0) > 0;
        if (!sameAsUsual) {
          const res = await fetch('/api/cleaner/availability/date-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: d.iso,
              slots: d.eff.ranges.map((s) => ({ startTime: s.start, endTime: s.end })),
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as { error?: string }).error || 'Could not save');
          }
          nextDateSlots[d.iso] = d.eff.ranges.map((s) => ({ ...s }));
        } else if (hadCustom) {
          const res = await fetch('/api/cleaner/availability/date-slots', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: d.iso }),
          });
          if (!res.ok) throw new Error('Could not save');
          delete nextDateSlots[d.iso];
        }
      }

      setBlocked(blockedNext);
      setDateSlots(nextDateSlots);
      setPlan({});
      haptic('success');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      haptic('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save');
      // Partial commits are possible — refetch so the screen shows the truth.
      fetchAll();
    } finally {
      setWeekSaving(false);
    }
  };

  const toggleDay = (day: ApiDay) => {
    haptic('light');
    const next = {
      ...weekly,
      [day]: weekly[day].length ? [] : [{ start: '09:00', end: '17:00' }],
    };
    commit(next, blocked);
  };

  const toggleBlockedDate = (iso: string) => {
    haptic('light');
    const isBlocked = blocked.some((b) => b.date === iso);
    const next = isBlocked
      ? blocked.filter((b) => b.date !== iso)
      : [...blocked, { date: iso, reason: 'Unavailable' }];
    commit(weekly, next);
  };

  // W6: save exactly one settings field (B1-safe — nothing else rides the PUT).
  const saveSetting = async (
    field: 'bookingBufferMinutes' | 'availableNow',
    value: number | boolean
  ) => {
    haptic('light');
    setSettingBusy(field === 'availableNow' ? 'sameDay' : 'buffer');
    setSaveError(null);
    try {
      const res = await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Could not save');
      if (field === 'availableNow') setSameDay(value as boolean);
      else setBuffer(value as 30 | 60);
      haptic('success');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      haptic('error');
      setSaveError('Could not save — try again');
    } finally {
      setSettingBusy(null);
    }
  };

  // ── Sheet chips (My Usual / Morning Only / Afternoon Only) ──
  const applyChip = (chip: 'usual' | 'morning' | 'afternoon') => {
    haptic('light');
    setEditError(null);
    if (!editing) return;
    if (chip === 'usual') {
      const usual = weekly[editing.day].map((s) => ({ ...s }));
      setEditSlots(usual.length ? usual : [{ start: '09:00', end: '17:00' }]);
    } else if (chip === 'morning') {
      setEditSlots([{ start: '08:00', end: '12:00' }]);
    } else {
      setEditSlots([{ start: '12:00', end: '17:00' }]);
    }
  };

  // ── Render ──
  if (accessDenied) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/10 px-5 py-4">
        <p className="text-sm font-medium text-danger">Please sign in to manage availability.</p>
      </div>
    );
  }

  if (!loading && loadError) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-jost text-xl font-semibold text-ink">
          Couldn&apos;t load your availability
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchAll();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-line" />
        <div className="h-72 animate-pulse rounded-2xl bg-line" />
        <div className="h-48 animate-pulse rounded-2xl bg-line" />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
            Availability
          </h1>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <AccountMenu />
            <InboxBell />
          </div>
        </div>
        <p className="mt-1 font-jost text-sm text-ink-2">
          {hrsStr(weeklyHours)}h a week on your usual schedule
        </p>
      </header>

      {(saveError || savedFlash) && (
        <div
          className={`mb-4 rounded-lg px-4 py-2.5 font-jost text-sm ${
            saveError ? 'bg-danger/10 text-danger' : 'bg-trust/10 text-trust'
          }`}
        >
          {saveError || 'Saved'}
        </div>
      )}
      {doneFlash && !saveError && (
        <div
          className="mb-4 rounded-lg bg-primary-soft px-4 py-2.5 font-jost text-sm text-primary"
          data-testid="done-readback"
        >
          {doneFlash}
        </div>
      )}

      {/* ── Your Week Ahead: the front page ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-jost text-lg font-semibold text-ink">Your Week Ahead</h2>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            The next seven days · tap a time to change it
          </p>
        </div>
        <div className="divide-y divide-line/60">
          {week.map((d) => {
            const on = !d.eff.off;
            return (
              <div
                key={d.iso}
                className={`flex items-center justify-between px-5 py-3 ${
                  d.tweaked ? 'bg-primary-soft/40' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => (on ? openDate(d.iso, d.day) : toggleWeekDay(d.iso))}
                  className="min-h-[44px] flex-1 text-left"
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`font-jost text-[15px] ${on ? 'font-medium text-ink' : 'text-ink-3'}`}
                    >
                      {d.label}
                    </span>
                    <span className="font-jost text-[11px] uppercase tracking-[0.08em] text-ink-3">
                      {d.dateShort}
                    </span>
                  </span>
                  <span
                    className={`block font-jost text-[13px] ${on ? 'text-ink-2' : 'text-ink-3'}`}
                  >
                    {on ? rowText(d.eff.ranges) : 'Off'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleWeekDay(d.iso)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${d.label} ${d.dateShort} availability`}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    on ? 'bg-primary' : 'bg-ink-3/30'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                      on ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={setMyWeek}
            disabled={!weekDirty || weekSaving}
            data-testid="set-my-week"
            className="w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {weekSaving ? 'Saving…' : `Set My Week — ${hrsStr(weekHoursOpen)} hrs open`}
          </button>
        </div>
      </section>

      {/* ── Usual hours: the secondary card (same sheet edits it) ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-jost text-lg font-semibold text-ink">Usual Hours</h2>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Repeats every week · tap a day to set hours
          </p>
        </div>
        <div className="divide-y divide-line/60">
          {API_DAYS.map((day) => {
            const on = weekly[day].length > 0;
            return (
              <div key={day} className="flex items-center justify-between px-5 py-3">
                <button
                  type="button"
                  onClick={() => (on ? openDay(day) : toggleDay(day))}
                  className="min-h-[44px] flex-1 text-left"
                >
                  <span
                    className={`font-jost text-[15px] ${on ? 'font-medium text-ink' : 'text-ink-3'}`}
                  >
                    {DAY_LABEL[day]}
                  </span>
                  <span className="ml-3 font-jost text-[13px] text-ink-3">
                    {on ? rowText(weekly[day]) : 'Off'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${DAY_LABEL[day]} availability`}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    on ? 'bg-primary' : 'bg-ink-3/30'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                      on ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── W6: Time off (Shape 1) — one card, one commit, regulars warned ── */}
      <TimeOffCard onDone={fetchAll} />

      {/* ── Blocked dates ── */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-jost text-lg font-semibold text-ink">Blocked Dates</h2>
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Days off, holidays
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setShowCalendar(true);
            }}
            className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white active:opacity-80"
          >
            Choose dates
          </button>
        </div>
        <div className="px-5 py-3.5">
          {blocked.length === 0 ? (
            <p className="font-jost text-sm text-ink-3">No blocked dates.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...blocked]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((b) => (
                  <button
                    key={b.date}
                    type="button"
                    onClick={() => toggleBlockedDate(b.date)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-page px-3 py-1.5 font-jost text-[13px] text-ink-2 active:bg-line"
                  >
                    {new Date(`${b.date}T00:00:00`).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    <svg
                      className="h-3.5 w-3.5 text-ink-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ── W6: settings rows beneath the Time-off card ── */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-jost text-lg font-semibold text-ink">Booking Settings</h2>
        </div>
        <div className="divide-y divide-line/60">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="font-jost text-[15px] text-ink">Gap between jobs</p>
              <p className="font-jost text-[12px] text-ink-3">
                Travel time kept clear around bookings
              </p>
            </div>
            <div className="inline-flex rounded-full border border-line bg-page p-0.5">
              {([30, 60] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={settingBusy === 'buffer'}
                  onClick={() => v !== buffer && saveSetting('bookingBufferMinutes', v)}
                  className={`rounded-full px-3.5 py-1.5 font-jost text-[13px] font-medium transition-colors disabled:opacity-60 ${
                    buffer === v ? 'bg-primary text-white' : 'text-ink-2'
                  }`}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="font-jost text-[15px] text-ink">Same-day bookings</p>
              <p className="font-jost text-[12px] text-ink-3">Customers can book you for today</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sameDay}
              aria-label="Same-day bookings"
              disabled={settingBusy === 'sameDay'}
              onClick={() => saveSetting('availableNow', !sameDay)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                sameDay ? 'bg-primary' : 'bg-ink-3/30'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                  sameDay ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* ── Day editor sheet: chips + native wheels (the ruled sheet) ── */}
      {editing && (
        <Sheet
          title={
            editing.kind === 'date'
              ? new Date(`${editing.date}T00:00:00`).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : `Every ${DAY_LABEL[editing.day]}`
          }
          subtitle={
            editing.kind === 'date'
              ? 'This date only — saved when you set your week'
              : 'Part of your usual week — saves straight away'
          }
          onClose={() => setEditing(null)}
        >
          {/* Chips */}
          <div className="mt-4 flex gap-2">
            {(
              [
                ['usual', 'My Usual'],
                ['morning', 'Morning Only'],
                ['afternoon', 'Afternoon Only'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyChip(key)}
                className="rounded-full border border-line bg-page px-3.5 py-2 font-jost text-[13px] font-medium text-ink-2 active:bg-primary-soft active:text-primary"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stacked time ranges */}
          <div className="mt-4 space-y-2.5">
            {editSlots.map((slot, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <TimeWheel
                    value={slot.start}
                    options={START_OPTIONS}
                    ariaLabel={`Range ${i + 1} start`}
                    onChange={(v) => {
                      setEditSlots((prev) =>
                        prev.map((s, j) =>
                          j === i
                            ? {
                                ...s,
                                start: v,
                                // Keep the range legal: end always after start.
                                end:
                                  trackMin(s.end) <= toMin(v)
                                    ? toMin(v) + SNAP >= TRACK_END
                                      ? '23:59'
                                      : toTime(toMin(v) + SNAP)
                                    : s.end,
                              }
                            : s
                        )
                      );
                      setEditError(null);
                    }}
                  />
                  <span className="font-jost text-[13px] text-ink-3">to</span>
                  <TimeWheel
                    value={slot.end}
                    options={END_OPTIONS}
                    ariaLabel={`Range ${i + 1} end`}
                    onChange={(v) => {
                      setEditSlots((prev) => prev.map((s, j) => (j === i ? { ...s, end: v } : s)));
                      setEditError(null);
                    }}
                  />
                  <span className="ml-auto font-jost text-[12px] text-ink-3">
                    {hrsStr((trackMin(slot.end) - toMin(slot.start)) / 60)}h
                  </span>
                  {editSlots.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove range ${i + 1}`}
                      onClick={() => {
                        haptic('light');
                        setEditSlots((prev) => prev.filter((_, j) => j !== i));
                        setEditError(null);
                      }}
                      className="rounded-full border border-line p-1.5 text-ink-3 active:bg-page"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {/* F18: the recurring opt-in was web-portal-only — a cleaner
                    living in the app could never open a slot to regular
                    clients, which silently suppressed the customer-facing
                    offer everywhere. Weekly ranges only (the date-slots API
                    carries no flag). */}
                {editing.kind === 'day' && (
                  <label className="mt-2.5 flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={!!slot.recurringEligible}
                      onChange={() => {
                        haptic('light');
                        setEditSlots((prev) =>
                          prev.map((s, j) =>
                            j === i ? { ...s, recurringEligible: !s.recurringEligible } : s
                          )
                        );
                      }}
                      className="h-4 w-4 rounded border-ink/20 text-primary focus:ring-primary/30"
                    />
                    <span className="font-jost text-[13px] text-ink-2">
                      Open to regular clients
                    </span>
                  </label>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              haptic('light');
              setEditSlots((prev) => {
                const lastEnd = prev.length ? trackMin(prev[prev.length - 1].end) : 9 * 60;
                const start = Math.min(lastEnd, TRACK_END - 2 * SNAP);
                const end = Math.min(start + 120, TRACK_END);
                return [
                  ...prev,
                  { start: toTime(start), end: end >= TRACK_END ? '23:59' : toTime(end) },
                ];
              });
              setEditError(null);
            }}
            className="mt-3 font-jost text-sm font-medium text-primary"
          >
            + Add Another Time
          </button>

          {editError && <p className="mt-3 font-jost text-[13px] text-danger">{editError}</p>}

          <button
            type="button"
            onClick={saveSheet}
            disabled={editSaving}
            data-testid="sheet-done"
            className="mt-5 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white active:opacity-80 disabled:opacity-50"
          >
            {editSaving ? 'Saving…' : 'Done'}
          </button>
        </Sheet>
      )}

      {/* ── Blocked-dates calendar sheet ── */}
      {showCalendar && (
        <CalendarSheet
          blocked={blocked}
          onToggle={toggleBlockedDate}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}

// ── W6: Time off card (Shape 1, James-ruled) ──────────────────────────────────
// From/To → a live preview of affected regular cleans (count-only, nothing
// sent), then ONE commit driving the same holiday endpoint as the web: flags
// the occurrences, emails each affected customer once, and blocks the range.
function TimeOffCard({ onDone }: { onDone: () => void }) {
  const todayIso = isoOf(new Date());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<{ flagged: number; customers: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeValid = !!from && !!to && from >= todayIso && to >= from;

  useEffect(() => {
    // result is NOT cleared here — the success line must survive this effect
    // re-running (the date onChange handlers clear it when a new range starts).
    setPreview(null);
    setError(null);
    if (!rangeValid) return;
    let cancelled = false;
    setPreviewing(true);
    (async () => {
      try {
        const res = await fetch('/api/cleaner/occurrences/holiday', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: from, endDate: to, preview: true }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.preview) {
          setPreview({ flagged: data.flagged ?? 0, customers: data.customers ?? 0 });
        }
      } catch {
        /* preview is best-effort — the commit re-checks server-side */
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, rangeValid]);

  const commit = async () => {
    if (!rangeValid || committing) return;
    haptic('medium');
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cleaner/occurrences/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: from, endDate: to }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not block that time off');
      haptic('success');
      // Fields stay filled — the cleaner sees exactly what was blocked, and
      // the commit button locks until they start a new range.
      setResult(data?.message || 'Time off blocked.');
      onDone();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Could not block that time off');
    } finally {
      setCommitting(false);
    }
  };

  const inputCls =
    'w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 font-jost text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="font-jost text-lg font-semibold text-ink">Time Off</h2>
        <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
          Going away? Block the whole stretch in one go
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              From
            </span>
            <input
              type="date"
              value={from}
              min={todayIso}
              onChange={(e) => {
                setFrom(e.target.value);
                setResult(null);
              }}
              className={inputCls}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              To
            </span>
            <input
              type="date"
              value={to}
              min={from || todayIso}
              onChange={(e) => {
                setTo(e.target.value);
                setResult(null);
              }}
              className={inputCls}
            />
          </label>
        </div>

        {rangeValid && preview !== null && !result && (
          <p
            className={`mt-3 font-jost text-[13px] ${preview.flagged > 0 ? 'text-amber-700' : 'text-ink-2'}`}
            data-testid="timeoff-preview"
          >
            {preview.flagged > 0
              ? `${preview.flagged} regular clean${preview.flagged === 1 ? '' : 's'} fall${
                  preview.flagged === 1 ? 's' : ''
                } in this time — your customer${preview.customers === 1 ? ' will' : 's will'} be told.`
              : 'No regular cleans fall in this time.'}
          </p>
        )}

        {error && <p className="mt-3 font-jost text-[13px] text-danger">{error}</p>}
        {result && (
          <p className="mt-3 font-jost text-[13px] text-trust" data-testid="timeoff-result">
            {result}
          </p>
        )}

        <button
          type="button"
          data-testid="timeoff-commit"
          disabled={!rangeValid || previewing || committing || !!result}
          onClick={commit}
          className="mt-4 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
        >
          {committing ? 'Blocking…' : 'Block this time off'}
        </button>
      </div>
    </section>
  );
}

// ── Month calendar for blocking dates ─────────────────────────────────────────
function CalendarSheet({
  blocked,
  onToggle,
  onClose,
}: {
  blocked: BlockedDate[];
  onToggle: (iso: string) => void;
  onClose: () => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const todayIso = isoOf(new Date());

  const view = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: firstDow }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(isoOf(new Date(year, month, d)));
    return {
      label: base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      cells,
    };
  }, [monthOffset]);

  return (
    <Sheet
      title="Blocked dates"
      subtitle="Tap a date to block or unblock it — saves straight away"
      onClose={onClose}
    >
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m - 1)}
          disabled={monthOffset === 0}
          aria-label="Previous month"
          className="rounded-full border border-line p-2 text-ink-2 active:bg-page disabled:opacity-30"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="font-jost text-base font-semibold text-ink">{view.label}</p>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          aria-label="Next month"
          className="rounded-full border border-line p-2 text-ink-2 active:bg-page"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="py-1 font-jost text-[11px] uppercase text-ink-3">
            {d}
          </span>
        ))}
        {view.cells.map((iso, i) => {
          if (!iso) return <span key={`pad-${i}`} />;
          const isPast = iso < todayIso;
          const isBlocked = blocked.some((b) => b.date === iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onToggle(iso)}
              className={`aspect-square rounded-lg font-jost text-sm ${
                isBlocked
                  ? 'bg-danger/10 font-semibold text-danger ring-1 ring-danger/30'
                  : isPast
                    ? 'text-ink-3/40'
                    : 'text-ink active:bg-page'
              }`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white active:opacity-80"
      >
        Done
      </button>
    </Sheet>
  );
}
