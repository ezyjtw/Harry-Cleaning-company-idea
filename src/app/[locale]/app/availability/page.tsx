'use client';

// C2: the Rena Pro Availability screen (L2). Same APIs as the portal page —
// GET/PUT /api/cleaner/availability, POST/DELETE /api/cleaner/availability/date-slots
// — the portal page is untouched. Served only inside the shell (/app layout gate).
//
// P2.5 AVAILABILITY V2 (James-ruled, App Review Batch 1): ONE calendar. The
// standing-week template has no UI surface of its own — the sheet's
// "Just This Week / Every [Dayname]" segmented choice is the only way to touch
// it. Weeks start blank: recurring (template) days arrive pre-filled wearing ↻,
// everything else reads "+ Add Hours". Untouched week = only recurring hours
// open — the intended opt-in model. All edits STAGE locally and commit together
// on SET MY WEEK. Blocked Dates card retired into the Time Off card (same
// override machinery). Data mapping is EXACTLY the timesheet core's precedence
// (date slots ELSE template, minus overrides) — no mechanics change anywhere.

import { useCallback, useEffect, useMemo, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';
import { haptic } from '@/components/app/job-cards';

interface TimeSlot {
  start: string;
  end: string;
  // F18: "Open To Regular Clients" — rides the same GET/PUT payload as the
  // portal page. Weekly (template) ranges only; the date-slots API has no flag,
  // so just-this-week hours can never be regular slots (James-ruled).
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
// The one voice (James-ruled bf6116d): compact am/pm — "8:30am–11:30am & 1–3pm".
// Suffix always on the range end; minutes dropped when :00; a bare-hour start
// sharing the end's suffix drops its own. Web portal keeps its own voice.
function suffixOf(t: string): 'am' | 'pm' {
  if (t === '23:59') return 'am'; // rendered 12am
  return parseInt(t.split(':')[0], 10) < 12 ? 'am' : 'pm';
}
function rangeVoice(r: TimeSlot): string {
  let startS = fmt(r.start);
  if (suffixOf(r.start) === suffixOf(r.end) && !startS.includes(':')) {
    startS = startS.slice(0, -2);
  }
  return `${startS}–${fmt(r.end)}`;
}
function rangesVoice(ranges: TimeSlot[]): string {
  return ranges.map(rangeVoice).join(' & ');
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
  if (ranges.length <= 2) return rangesVoice(ranges);
  return `${ranges.length} times · ${hrsStr(hoursOf(ranges))} hrs`;
}

// The ↻ recurring mark (small, navy, before the hours).
function RecurMark() {
  return (
    <span aria-label="Repeats every week" className="mr-1 font-jost text-[13px] text-primary">
      ↻
    </span>
  );
}

// ── Native time wheels (30-min steps) ─────────────────────────────────────────
// Plain <select>s: iOS renders them as native wheel pickers inside the WebView
// — the ruled control, kept as shipped (chip-strip alternative is ledgered).
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

// One-calendar model: the sheet always edits a DATE; the segmented choice
// decides whether Done stages just that date or the standing template.
interface EditTarget {
  date: string;
  day: ApiDay;
}

// The staged shape of one week-card day. off=true → full-day block staged.
// off=false with ranges=[] → day cleared back to blank (one-off removed).
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

  // Staged changes. `plan` = per-date; `stagedWeekly` = template days edited
  // via "Every [Dayname]" (invisible template, committed with SET MY WEEK).
  const [plan, setPlan] = useState<Record<string, DayPlan>>({});
  const [stagedWeekly, setStagedWeekly] = useState<Partial<Record<ApiDay, TimeSlot[]>>>({});
  const [weekSaving, setWeekSaving] = useState(false);

  // Week pager: 0 = week commencing this Monday, 1 = next week. Max one ahead.
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [doneFlash, setDoneFlash] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);
  // Segmented choice: 'week' = Just This Week (date slot), 'every' = template.
  const [editScope, setEditScope] = useState<'week' | 'every'>('week');
  // F18 switch (shown only under "Every [Day]"): applied to every range of
  // that template day on Done. Data stays per-range; this surface sets them
  // together.
  const [editRegular, setEditRegular] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // W6: the two settings rows (buffer, same-day).
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
      setStagedWeekly({});
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
  // has separate UI for (availableNow, bookingBufferMinutes) are deliberately
  // NOT sent — the API treats absent fields as untouched, and echoing them
  // back from a stale snapshot could clobber a value saved elsewhere (B1).
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

  // Immediate commit path — used by the Time Off card's block removal (the
  // week card itself stages and commits via SET MY WEEK).
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

  // Template with staged "Every [Day]" edits applied.
  const effWeekly = useMemo(() => {
    const next = { ...weekly };
    for (const d of API_DAYS) {
      const staged = stagedWeekly[d];
      if (staged) next[d] = staged;
    }
    return next;
  }, [weekly, stagedWeekly]);

  const todayIso = isoOf(new Date());

  // ── The week card: Monday-commencing calendar week + offset ──
  const week = useMemo(() => {
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = isoOf(d);
      const day = JS_DAY_TO_API[d.getDay()];
      const isPast = iso < todayIso;
      const isBlocked = blocked.some((b) => b.date === iso);
      const savedCustom = (dateSlots[iso]?.length ?? 0) > 0;
      const baseline: DayPlan = {
        off: isBlocked,
        ranges: savedCustom ? dateSlots[iso] : effWeekly[day],
      };
      const eff = plan[iso] ?? baseline;
      // ↻ = these hours ARE the standing template's (no date-slot, no staged
      // one-off differing from it).
      const recurring =
        !eff.off &&
        eff.ranges.length > 0 &&
        !savedCustom &&
        effWeekly[day].length > 0 &&
        rangesEqual(eff.ranges, effWeekly[day]);
      return {
        iso,
        day,
        label: DAY_LABEL[day],
        isToday: iso === todayIso,
        isPast,
        baseline,
        eff,
        recurring,
        blank: !eff.off && eff.ranges.length === 0,
        dirty: eff.off !== baseline.off || !rangesEqual(eff.ranges, baseline.ranges),
      };
    });
  }, [weekOffset, todayIso, blocked, dateSlots, effWeekly, plan]);

  const weekCommencing = useMemo(() => {
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
    return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  }, [weekOffset]);

  const templateDirty = API_DAYS.some((d) => {
    const staged = stagedWeekly[d];
    return !!staged && !rangesEqual(staged, weekly[d]);
  });
  const anyDirty = week.some((d) => d.dirty) || Object.keys(plan).length > 0 || templateDirty;
  const weekHoursOpen = week.reduce(
    (s, d) => s + (d.eff.off || d.isPast ? 0 : hoursOf(d.eff.ranges)),
    0
  );

  // ── Week-card interactions (all staged) ──
  const toggleWeekDay = (iso: string) => {
    haptic('light');
    setDoneFlash(null);
    const d = week.find((w) => w.iso === iso);
    if (!d || d.isPast) return;
    if (d.eff.off) {
      // Off → back on with what it had (or the template).
      const ranges = d.eff.ranges.length
        ? d.eff.ranges
        : effWeekly[d.day].length
          ? effWeekly[d.day].map((s) => ({ ...s }))
          : [];
      setPlan((p) => ({ ...p, [iso]: { off: false, ranges } }));
    } else if (d.recurring) {
      // Recurring day off = full-day block for THIS date only (template kept).
      setPlan((p) => ({ ...p, [iso]: { off: true, ranges: d.eff.ranges } }));
    } else {
      // One-off day off = clear it back to blank (removes the date slot).
      setPlan((p) => ({ ...p, [iso]: { off: false, ranges: [] } }));
    }
  };

  const openDate = (iso: string, day: ApiDay) => {
    haptic('light');
    const d = week.find((w) => w.iso === iso);
    const current = d && !d.eff.off ? d.eff.ranges : [];
    const slots = (current.length ? current : effWeekly[day]).map((s) => ({ ...s }));
    setEditSlots(slots.length ? slots : [{ start: '09:00', end: '17:00' }]);
    // Truthful default: a day whose hours ARE the template opens on
    // "Every [Day]" (that's what it is); blank and one-off days open on
    // "Just This Week".
    const recurringNow = !!d?.recurring;
    setEditScope(recurringNow ? 'every' : 'week');
    setEditRegular(recurringNow ? effWeekly[day].some((s) => s.recurringEligible) : false);
    setEditError(null);
    setDoneFlash(null);
    setEditing({ date: iso, day });
  };

  // Sheet Done: everything stages; SET MY WEEK commits.
  const saveSheet = () => {
    if (!editing) return;
    const err = validateRanges(editSlots);
    if (err) {
      setEditError(err);
      return;
    }
    const ranges = editSlots.map((s) => ({ ...s }));
    if (editScope === 'every') {
      // Update the standing template invisibly; F18 applies to every range.
      const flagged = ranges.map((s) => ({ ...s, recurringEligible: editRegular }));
      setStagedWeekly((p) => ({ ...p, [editing.day]: flagged }));
      // This date follows its template: stage it equal so any saved date-slot
      // override is deleted on commit.
      setPlan((p) => ({ ...p, [editing.date]: { off: false, ranges: flagged } }));
    } else {
      setPlan((p) => ({ ...p, [editing.date]: { off: false, ranges } }));
    }
    haptic('success');
    setDoneFlash(`Done — free ${rangesVoice(ranges)}`);
    setEditing(null);
  };

  // ── SET MY WEEK: commit every staged change through the existing endpoints ──
  const setMyWeek = async () => {
    if (!anyDirty || weekSaving) return;
    haptic('medium');
    setWeekSaving(true);
    setSaveError(null);
    setDoneFlash(null);
    try {
      // 1) Template + blocked-date changes ride ONE PUT.
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
      if (blockedChanged || templateDirty) await putAll(effWeekly, blockedNext);

      // 2) Per-date overrides: differs from template → POST; matches template
      //    (or cleared) → DELETE any saved date slot.
      const nextDateSlots = { ...dateSlots };
      for (const d of week) {
        if (!d.dirty || d.eff.off) continue;
        const sameAsTemplate = rangesEqual(d.eff.ranges, effWeekly[d.day]);
        const hadCustom = (dateSlots[d.iso]?.length ?? 0) > 0;
        if (!sameAsTemplate && d.eff.ranges.length > 0) {
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

      setWeekly(effWeekly);
      setBlocked(blockedNext);
      setDateSlots(nextDateSlots);
      setPlan({});
      setStagedWeekly({});
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
      const usual = effWeekly[editing.day].map((s) => ({ ...s }));
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
        <div className="h-28 animate-pulse rounded-2xl bg-line" />
        <div className="h-72 animate-pulse rounded-2xl bg-line" />
      </div>
    );
  }

  return (
    <div>
      {/* ── 1. Header ── */}
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

      {/* ── 2. "Two Ways To Be Open" explainer ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="px-5 pb-4 pt-4">
          <h2 className="font-jost text-lg font-semibold text-ink">Two Ways To Be Open</h2>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-ink-2"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
              <p className="font-jost text-[13px] leading-snug text-ink-2">
                This week&apos;s hours — one-off time you&apos;re free. Good for jobs as they come.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-[-1px] w-4 shrink-0 text-center font-jost text-[15px] leading-none text-primary">
                ↻
              </span>
              <p className="font-jost text-[13px] leading-snug text-ink-2">
                Regular slots — hours you keep every week. Clients can book these as their standing
                clean.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-primary-soft px-5 py-2.5">
          <p className="font-jost text-[12px] font-medium text-primary">
            Regular clients are steady money — set at least a few ↻ hours if you can.
          </p>
        </div>
      </section>

      {/* ── 3. Week header — stacked, pagers flanking ── */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (weekOffset === 1) {
              haptic('light');
              setWeekOffset(0);
            }
          }}
          disabled={weekOffset === 0}
          aria-label="Previous week"
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
        <div className="text-center">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Week Commencing
          </p>
          <p className="font-jost text-[22px] font-bold leading-tight text-primary">
            {weekCommencing}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (weekOffset === 0) {
              haptic('light');
              setWeekOffset(1);
            }
          }}
          disabled={weekOffset === 1}
          aria-label="Next week"
          className="rounded-full border border-line p-2 text-ink-2 active:bg-page disabled:opacity-30"
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

      {/* ── 4. The week card ── */}
      <section className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="divide-y divide-line/60">
          {week.map((d) => {
            const on = !d.eff.off && d.eff.ranges.length > 0;
            if (d.isPast) {
              return (
                <div key={d.iso} className="flex items-center justify-between px-5 py-3 opacity-40">
                  <div className="min-h-[44px] flex-1 py-1">
                    <span className="font-jost text-[15px] text-ink-3">{d.label}</span>
                    <span className="block font-jost text-[13px] text-ink-3">
                      {on ? rowText(d.eff.ranges) : 'Off'}
                    </span>
                  </div>
                </div>
              );
            }
            if (d.blank) {
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => openDate(d.iso, d.day)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left active:bg-page"
                >
                  <div className="min-h-[44px] flex-1 py-1">
                    <span className="font-jost text-[15px] text-ink-3">{d.label}</span>
                    <span className="block font-jost text-[13px] font-medium text-primary">
                      + Add Hours
                    </span>
                  </div>
                </button>
              );
            }
            return (
              <div
                key={d.iso}
                className={`flex items-center justify-between px-5 py-3 ${
                  d.dirty ? 'bg-primary-soft/40' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => (on ? openDate(d.iso, d.day) : toggleWeekDay(d.iso))}
                  className="min-h-[44px] flex-1 py-1 text-left"
                >
                  <span
                    className={`font-jost text-[15px] ${on ? 'font-medium text-ink' : 'text-ink-3'}`}
                  >
                    {d.label}
                  </span>
                  <span
                    className={`block font-jost text-[13px] ${on ? 'text-ink-2' : 'text-ink-3'}`}
                  >
                    {on ? (
                      <>
                        {d.recurring && <RecurMark />}
                        {rowText(d.eff.ranges)}
                      </>
                    ) : (
                      'Off'
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleWeekDay(d.iso)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${d.label} availability`}
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

      {/* ── 5. SET MY WEEK ── */}
      <button
        type="button"
        onClick={setMyWeek}
        disabled={!anyDirty || weekSaving}
        data-testid="set-my-week"
        className="mb-6 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold uppercase tracking-[0.04em] text-white active:opacity-80 disabled:opacity-40"
      >
        {weekSaving ? 'Saving…' : `Set My Week — ${hrsStr(weekHoursOpen)} Hrs Open`}
      </button>

      {/* ── 6. W6: settings rows ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
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

      {/* ── 7. Time Off (absorbs Blocked Dates — same override machinery) ── */}
      <TimeOffCard blocked={blocked} weekly={weekly} onCommit={commit} onDone={fetchAll} />

      {/* ── Day editor sheet ── */}
      {editing && (
        <Sheet
          title={new Date(`${editing.date}T00:00:00`).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          subtitle="Saved when you set your week"
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

          {/* Segmented choice — the sheet's last element (one-calendar model) */}
          <div className="mt-5 rounded-xl border border-line bg-page p-1">
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ['week', 'Just This Week'],
                  ['every', `Every ${DAY_LABEL[editing.day]}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    haptic('light');
                    setEditScope(key);
                  }}
                  aria-pressed={editScope === key}
                  className={`rounded-lg px-3 py-2 font-jost text-[13px] font-medium transition-colors ${
                    editScope === key ? 'bg-primary text-white' : 'text-ink-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* F18 — only when the hours repeat weekly (template ranges carry the
              flag; date slots can't). */}
          {editScope === 'every' && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
              <div>
                <p className="font-jost text-[14px] font-medium text-ink">
                  Open To Regular Clients
                </p>
                <p className="font-jost text-[12px] text-ink-3">
                  Customers can book this as their standing weekly slot
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editRegular}
                aria-label="Open to regular clients"
                onClick={() => {
                  haptic('light');
                  setEditRegular((v) => !v);
                }}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  editRegular ? 'bg-primary' : 'bg-ink-3/30'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                    editRegular ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {editError && <p className="mt-3 font-jost text-[13px] text-danger">{editError}</p>}

          <button
            type="button"
            onClick={saveSheet}
            data-testid="sheet-done"
            className="mt-5 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white active:opacity-80"
          >
            Done
          </button>
        </Sheet>
      )}
    </div>
  );
}

// ── Time Off card V2 (absorbs Blocked Dates — James-ruled P2.5 #5) ────────────
// From/Until → live preview of affected regular cleans → ONE commit driving the
// same holiday endpoint as the web (flags occurrences, emails each affected
// customer once, blocks the range). Below it, COMING UP lists every future
// block (grouped into contiguous runs) with an × that removes it through the
// existing blockedDates PUT — no mechanics change.
function TimeOffCard({
  blocked,
  weekly,
  onCommit,
  onDone,
}: {
  blocked: BlockedDate[];
  weekly: Record<ApiDay, TimeSlot[]>;
  onCommit: (w: Record<ApiDay, TimeSlot[]>, b: BlockedDate[]) => Promise<boolean>;
  onDone: () => void;
}) {
  const todayIso = isoOf(new Date());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<{ flagged: number; customers: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Same date in both pickers = a single day off (James-ruled).
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

  const commitTimeOff = async () => {
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

  // COMING UP: future blocks grouped into contiguous runs.
  const upcoming = useMemo(() => {
    const dates = blocked
      .map((b) => b.date)
      .filter((d) => d >= todayIso)
      .sort();
    const runs: { start: string; end: string; dates: string[] }[] = [];
    for (const iso of dates) {
      const last = runs[runs.length - 1];
      if (last) {
        const next = new Date(`${last.end}T00:00:00`);
        next.setDate(next.getDate() + 1);
        if (isoOf(next) === iso) {
          last.end = iso;
          last.dates.push(iso);
          continue;
        }
      }
      runs.push({ start: iso, end: iso, dates: [iso] });
    }
    return runs;
  }, [blocked, todayIso]);

  const removeRun = async (run: { dates: string[] }) => {
    haptic('light');
    setRemoving(run.dates[0]);
    try {
      const next = blocked.filter((b) => !run.dates.includes(b.date));
      await onCommit(weekly, next);
    } finally {
      setRemoving(null);
    }
  };

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

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
              Until
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
          onClick={commitTimeOff}
          className="mt-4 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold uppercase tracking-[0.04em] text-white active:opacity-80 disabled:opacity-50"
        >
          {committing ? 'Blocking…' : 'Block This Time Off'}
        </button>

        {upcoming.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Coming Up
            </p>
            <div className="divide-y divide-line/60 rounded-xl border border-line">
              {upcoming.map((run) => (
                <div
                  key={run.start}
                  className="flex items-center justify-between px-4 py-2.5"
                  data-testid="timeoff-upcoming-row"
                >
                  <span className="font-jost text-[14px] text-ink">
                    {run.start === run.end
                      ? fmtDay(run.start)
                      : `${fmtDay(run.start)} – ${fmtDay(run.end)}`}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove time off ${fmtDay(run.start)}`}
                    disabled={removing === run.dates[0]}
                    onClick={() => removeRun(run)}
                    className="rounded-full border border-line p-1.5 text-ink-3 active:bg-page disabled:opacity-40"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
