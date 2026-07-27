'use client';

// C2: the Rena Pro Availability screen (L2). Same APIs as the portal page —
// GET/PUT /api/cleaner/availability, POST/DELETE /api/cleaner/availability/date-slots
// — the portal page is untouched. Served only inside the shell (/app layout gate).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

// The visible track: 06:00 → 24:00 in 30-min snaps (matches the portal timeline).
const TRACK_START = 6 * 60;
const TRACK_END = 24 * 60;
const SNAP = 30;

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(mins: number): string {
  const m = Math.min(Math.max(mins, 0), 23 * 60 + 59);
  // The API's day ends at 23:59 (validated HH:mm); the track treats it as 24:00.
  if (m >= TRACK_END - 1) return '23:59';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function trackMin(t: string): number {
  // 23:59 renders at the 24:00 end of the track.
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
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
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

// ── Draggable 30-min-snap range track (one per range) ─────────────────────────
// Pointer events with capture; touch-action:none on the track so dragging never
// fights page scroll or the shell's pull-to-refresh. Handles at both ends resize;
// dragging the bar moves the whole window. The +/- steppers under the track are
// the precision path — the track is ~10px per 30-min snap on a phone, so coarse
// placement is drag, fine placement is a tap.
function RangeTrack({ slot, onChange }: { slot: TimeSlot; onChange: (next: TimeSlot) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: 'start' | 'end' | 'move';
    originX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const startM = Math.max(TRACK_START, toMin(slot.start));
  const endM = Math.min(TRACK_END, trackMin(slot.end));
  const span = TRACK_END - TRACK_START;
  const leftPct = ((startM - TRACK_START) / span) * 100;
  const widthPct = Math.max(2, ((endM - startM) / span) * 100);

  const beginDrag = (mode: 'start' | 'end' | 'move') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, originX: e.clientX, origStart: startM, origEnd: endM };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const pxPerMin = track.getBoundingClientRect().width / span;
    const deltaMin = Math.round((e.clientX - d.originX) / pxPerMin / SNAP) * SNAP;
    if (deltaMin === 0) return;
    let s = d.origStart;
    let en = d.origEnd;
    if (d.mode === 'start') s = Math.min(Math.max(TRACK_START, s + deltaMin), en - SNAP);
    else if (d.mode === 'end') en = Math.max(Math.min(TRACK_END, en + deltaMin), s + SNAP);
    else {
      const width = en - s;
      s = Math.min(Math.max(TRACK_START, s + deltaMin), TRACK_END - width);
      en = s + width;
    }
    if (s !== startM || en !== endM) {
      onChange({ start: toTime(s), end: en >= TRACK_END ? '23:59' : toTime(en) });
    }
  };

  const endDrag = () => {
    if (drag.current) haptic('light');
    drag.current = null;
  };

  return (
    <div>
      <div
        ref={trackRef}
        className="relative h-9 rounded-lg bg-page ring-1 ring-line"
        style={{ touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute inset-y-0 flex items-center justify-center rounded-lg bg-primary"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onPointerDown={beginDrag('move')}
        >
          <span className="pointer-events-none truncate px-4 font-jost text-[11px] font-medium text-white">
            {fmt(slot.start)}–{fmt(slot.end)}
          </span>
          {/* End handles: 28px hit targets overhanging the bar ends */}
          <span
            onPointerDown={beginDrag('start')}
            className="absolute -left-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
          >
            <span className="absolute left-1/2 top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
          </span>
          <span
            onPointerDown={beginDrag('end')}
            className="absolute -right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
          >
            <span className="absolute left-1/2 top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
          </span>
        </div>
      </div>
      <div className="mt-1 flex justify-between font-jost text-[9px] uppercase tracking-[0.08em] text-ink-3">
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>
      {/* Precision steppers (30-min taps) */}
      <div className="mt-2 flex items-center justify-between">
        <Stepper
          label="Start"
          value={slot.start}
          onStep={(dir) => {
            const s = toMin(slot.start) + dir * SNAP;
            if (s >= TRACK_START && s <= endM - SNAP) onChange({ ...slot, start: toTime(s) });
          }}
        />
        <Stepper
          label="End"
          value={slot.end}
          onStep={(dir) => {
            const en = trackMin(slot.end) + dir * SNAP;
            if (en >= startM + SNAP && en <= TRACK_END)
              onChange({ ...slot, end: en >= TRACK_END ? '23:59' : toTime(en) });
          }}
        />
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (dir: -1 | 1) => void;
}) {
  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface font-jost text-lg text-ink-2 active:bg-page';
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        {label}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => {
          haptic('light');
          onStep(-1);
        }}
        aria-label={`${label} 30 minutes earlier`}
      >
        −
      </button>
      <span className="w-14 text-center font-jost text-sm font-medium text-ink">{fmt(value)}</span>
      <button
        type="button"
        className={btn}
        onClick={() => {
          haptic('light');
          onStep(1);
        }}
        aria-label={`${label} 30 minutes later`}
      >
        +
      </button>
    </div>
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
            <p className="font-newsreader text-lg font-semibold text-ink">{title}</p>
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

// Editing target: a specific date (per-date override) or a weekday template.
type EditTarget = { kind: 'date'; date: string; day: ApiDay } | { kind: 'day'; day: ApiDay };

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

  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showCalendar, setShowCalendar] = useState(false);

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

  // ── Week strip data: the next 7 days from today ──
  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = isoOf(d);
      const day = JS_DAY_TO_API[d.getDay()];
      const isBlocked = blocked.some((b) => b.date === iso);
      const custom = (dateSlots[iso]?.length ?? 0) > 0;
      const slots = custom ? dateSlots[iso] : weekly[day];
      return {
        iso,
        day,
        dayShort: DAY_LABEL[day].slice(0, 3),
        dateNum: d.getDate(),
        isToday: i === 0,
        isBlocked,
        custom,
        hours: slots.reduce((s, r) => s + (trackMin(r.end) - toMin(r.start)) / 60, 0),
      };
    });
  }, [blocked, dateSlots, weekly]);

  const weeklyHours = useMemo(
    () =>
      API_DAYS.reduce(
        (sum, d) =>
          sum + weekly[d].reduce((s, r) => s + (trackMin(r.end) - toMin(r.start)) / 60, 0),
        0
      ),
    [weekly]
  );

  // ── Sheet open/close ──
  const openDate = (iso: string, day: ApiDay) => {
    haptic('light');
    const slots = (dateSlots[iso]?.length ? dateSlots[iso] : weekly[day]).map((s) => ({ ...s }));
    setEditSlots(slots.length ? slots : [{ start: '09:00', end: '17:00' }]);
    setEditError(null);
    setEditing({ kind: 'date', date: iso, day });
  };
  const openDay = (day: ApiDay) => {
    haptic('light');
    const slots = weekly[day].map((s) => ({ ...s }));
    setEditSlots(slots.length ? slots : [{ start: '09:00', end: '17:00' }]);
    setEditError(null);
    setEditing({ kind: 'day', day });
  };

  const saveSheet = async () => {
    if (!editing) return;
    const err = validateRanges(editSlots);
    if (err) {
      setEditError(err);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      if (editing.kind === 'date') {
        const res = await fetch('/api/cleaner/availability/date-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: editing.date,
            slots: editSlots.map((s) => ({ startTime: s.start, endTime: s.end })),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setEditError((data as { error?: string }).error || 'Could not save');
          haptic('error');
          return;
        }
        setDateSlots((prev) => ({ ...prev, [editing.date]: editSlots.map((s) => ({ ...s })) }));
        haptic('success');
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      } else {
        const ok = await commit({ ...weekly, [editing.day]: editSlots }, blocked);
        if (!ok) {
          setEditError('Could not save — try again');
          return;
        }
      }
      setEditing(null);
    } finally {
      setEditSaving(false);
    }
  };

  const copyToWeekdays = async () => {
    const err = validateRanges(editSlots);
    if (err) {
      setEditError(err);
      return;
    }
    haptic('medium');
    setEditSaving(true);
    try {
      const next = { ...weekly };
      for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as ApiDay[]) {
        next[d] = editSlots.map((s) => ({ ...s }));
      }
      const ok = await commit(next, blocked);
      if (ok) setEditing(null);
      else setEditError('Could not save — try again');
    } finally {
      setEditSaving(false);
    }
  };

  const revertDate = async (iso: string) => {
    haptic('light');
    const res = await fetch('/api/cleaner/availability/date-slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: iso }),
    }).catch(() => null);
    if (res?.ok) {
      setDateSlots((prev) => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
      haptic('success');
      setEditing(null);
    } else {
      setEditError('Could not revert — try again');
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
        <h1 className="font-newsreader text-xl font-semibold text-ink">
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
        <div className="h-24 animate-pulse rounded-2xl bg-line" />
        <div className="h-72 animate-pulse rounded-2xl bg-line" />
      </div>
    );
  }

  const editingBlocked = editing?.kind === 'date' && blocked.some((b) => b.date === editing.date);

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-newsreader text-[26px] font-semibold leading-tight text-ink">
          Availability
        </h1>
        <p className="mt-1 font-jost text-sm text-ink-2">
          {weeklyHours}h a week on your usual schedule
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

      {/* ── Week strip ── */}
      <section className="mb-6">
        <p className="mb-2 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          This week
        </p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {week.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => openDate(d.iso, d.day)}
              className={`min-w-[74px] shrink-0 rounded-2xl border p-3 text-center ${
                d.isBlocked
                  ? 'border-danger/30 bg-danger/5'
                  : d.isToday
                    ? 'border-primary bg-primary-soft'
                    : 'border-line bg-surface'
              } active:opacity-80`}
            >
              <p className="font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3">
                {d.dayShort}
              </p>
              <p
                className={`font-newsreader text-xl font-medium ${
                  d.isToday ? 'text-primary' : 'text-ink'
                }`}
              >
                {d.dateNum}
              </p>
              <p
                className={`mt-0.5 font-jost text-[11px] font-medium ${
                  d.isBlocked ? 'text-danger' : d.hours > 0 ? 'text-ink-2' : 'text-ink-3'
                }`}
              >
                {d.isBlocked ? 'Blocked' : d.hours > 0 ? `${d.hours}h` : 'Off'}
              </p>
              {d.custom && !d.isBlocked && (
                <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Recurring schedule: per-day toggles ── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-newsreader text-lg font-semibold text-ink">Usual week</h2>
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
                    {on
                      ? weekly[day].map((r) => `${fmt(r.start)}–${fmt(r.end)}`).join(', ')
                      : 'Off'}
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

      {/* ── Blocked dates ── */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="font-newsreader text-lg font-semibold text-ink">Blocked dates</h2>
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

      {/* ── Day editor sheet ── */}
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
              ? 'Sets this date only — your usual week is unchanged'
              : 'Part of your usual week'
          }
          onClose={() => setEditing(null)}
        >
          {editingBlocked ? (
            <div className="mt-5">
              <p className="font-jost text-sm text-ink-2">
                This date is blocked — you won&apos;t get offers for it.
              </p>
              <button
                type="button"
                onClick={() => {
                  toggleBlockedDate((editing as { date: string }).date);
                  setEditing(null);
                }}
                className="mt-4 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold text-white active:opacity-80"
              >
                Unblock this date
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5 space-y-5">
                {editSlots.map((slot, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface p-3">
                    <RangeTrack
                      slot={slot}
                      onChange={(next) => {
                        setEditSlots((prev) => prev.map((s, j) => (j === i ? next : s)));
                        setEditError(null);
                      }}
                    />
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
                    {editSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic('light');
                          setEditSlots((prev) => prev.filter((_, j) => j !== i));
                          setEditError(null);
                        }}
                        className="mt-2 font-jost text-[13px] font-medium text-danger"
                      >
                        Remove this range
                      </button>
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
                + Add another range
              </button>

              {editError && <p className="mt-3 font-jost text-[13px] text-danger">{editError}</p>}

              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={saveSheet}
                  disabled={editSaving}
                  className="w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white active:opacity-80 disabled:opacity-50"
                >
                  {editSaving
                    ? 'Saving…'
                    : editing.kind === 'date'
                      ? 'Save for this day'
                      : `Save every ${DAY_LABEL[editing.day]}`}
                </button>
                <button
                  type="button"
                  onClick={copyToWeekdays}
                  disabled={editSaving}
                  className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 font-jost text-sm font-medium text-ink-2 active:bg-page disabled:opacity-50"
                >
                  Copy to weekdays (Mon–Fri, every week)
                </button>
                {editing.kind === 'date' && (dateSlots[editing.date]?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => revertDate(editing.date)}
                    disabled={editSaving}
                    className="w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-ink-3 active:bg-page"
                  >
                    Revert to your usual {DAY_LABEL[editing.day]}
                  </button>
                )}
                {editing.kind === 'date' && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleBlockedDate(editing.date);
                      setEditing(null);
                    }}
                    disabled={editSaving}
                    className="w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-danger active:bg-danger/5"
                  >
                    Block this date
                  </button>
                )}
              </div>
            </>
          )}
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
        <p className="font-newsreader text-base font-semibold text-ink">{view.label}</p>
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
