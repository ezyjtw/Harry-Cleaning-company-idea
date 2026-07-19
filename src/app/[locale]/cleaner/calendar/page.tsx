'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import NavLink from '@/components/nav/NavLink';
import { serviceLabelFromSlug } from '@/lib/constants/services';

// H56 (James-ruled): the cleaner's PLANNING surface — "what's my week". A week
// view leads (day columns on desktop, a vertical day-scroller on phone,
// echoing the L2 availability day-chip grammar), with a compact month toggle
// for the further-out view. Data is confirmed work only (ACCEPTED/CONFIRMED/
// EN_ROUTE, paid-visible) — offers stay on the Jobs surface, which remains
// the WORKFLOW surface. Blocks deep-link to the job's card on /cleaner/jobs.

interface CalendarBooking {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  duration: number;
  serviceType: string;
  status: string;
  earnings: number;
  customerFirstName: string;
  postcodeArea: string;
}

const DAY_MS = 86400000;

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function mondayOf(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = copy.getUTCDay(); // 0=Sun
  copy.setUTCDate(copy.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return copy;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The Jobs page splits its list by tab — a deep link must land on the tab
// that actually contains the job or the anchor misses.
const JOBS_TAB_FOR_STATUS: Record<string, string> = {
  CONFIRMED: 'pending',
  ACCEPTED: 'upcoming',
  EN_ROUTE: 'on-the-way',
};

export default function CleanerCalendarPage() {
  const [view, setView] = useState<'week' | 'month'>('week');
  // Anchor: the Monday of the visible week, or the 1st of the visible month.
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayYMD = toYMD(new Date());

  // The fetched range covers whichever view is active.
  const range = useMemo(() => {
    if (view === 'week') {
      const end = new Date(weekStart.getTime() + 6 * DAY_MS);
      return { start: toYMD(weekStart), end: toYMD(end) };
    }
    const monthEnd = new Date(
      Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0)
    );
    return { start: toYMD(monthAnchor), end: toYMD(monthEnd) };
  }, [view, weekStart, monthAnchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/cleaner/calendar?start=${range.start}&end=${range.end}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load calendar'))))
      .then((d) => {
        if (!cancelled) setBookings(d.bookings || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your calendar. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    return map;
  }, [bookings]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart.getTime() + i * DAY_MS);
        return { ymd: toYMD(d), label: DAY_LABELS[i], dayNum: d.getUTCDate() };
      }),
    [weekStart]
  );

  const goWeek = useCallback(
    (delta: number) => setWeekStart((w) => new Date(w.getTime() + delta * 7 * DAY_MS)),
    []
  );
  const goToday = useCallback(() => setWeekStart(mondayOf(new Date())), []);
  const goMonth = useCallback(
    (delta: number) =>
      setMonthAnchor((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + delta, 1))),
    []
  );

  const weekHeading = useMemo(() => {
    const end = new Date(weekStart.getTime() + 6 * DAY_MS);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  }, [weekStart]);

  const monthHeading = useMemo(
    () =>
      monthAnchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [monthAnchor]
  );

  const BookingBlock = ({ b }: { b: CalendarBooking }) => (
    <NavLink
      surface="cleaner-calendar"
      href={`/cleaner/jobs?tab=${JOBS_TAB_FOR_STATUS[b.status] ?? 'pending'}#job-${b.id}`}
      className="block rounded-[10px] border border-primary/20 bg-primary-soft px-2.5 py-2 transition hover:border-primary/50"
    >
      <p className="font-jost text-[12px] font-medium text-primary">
        {b.startTime} · {b.duration}h
      </p>
      <p className="truncate font-jost text-[12px] text-ink">
        {b.customerFirstName} · {serviceLabelFromSlug(b.serviceType)}
      </p>
      <p className="font-jost text-[11px] font-light text-ink-3">
        {b.postcodeArea && `${b.postcodeArea} · `}£{b.earnings.toFixed(2)}
      </p>
    </NavLink>
  );

  // Month view: a compact grid — each day shows its booking count as dots;
  // clicking a day jumps the week view there.
  const monthCells = useMemo(() => {
    if (view !== 'month') return [];
    const first = monthAnchor;
    const firstDow = first.getUTCDay() === 0 ? 6 : first.getUTCDay() - 1; // Mon=0
    const daysInMonth = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const cells: ({ ymd: string; dayNum: number; count: number } | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day));
      const ymd = toYMD(d);
      cells.push({ ymd, dayNum: day, count: (byDay.get(ymd) ?? []).length });
    }
    return cells;
  }, [view, monthAnchor, byDay]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Calendar</h1>
          <p className="mt-0.5 font-jost text-sm font-light text-ink-2">
            Your confirmed work — offers live in{' '}
            <NavLink
              surface="cleaner-calendar"
              href="/cleaner/jobs"
              className="text-primary underline"
            >
              My Jobs
            </NavLink>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-[10px] border border-line">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 font-jost text-[12px] font-medium capitalize transition ${
                  view === v ? 'bg-ink text-white' : 'bg-surface text-ink-2 hover:bg-page'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Range navigation */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          onClick={() => (view === 'week' ? goWeek(-1) : goMonth(-1))}
          aria-label="Previous"
          className="rounded-[10px] border border-line bg-surface px-3 py-1.5 font-jost text-sm text-ink-2 transition hover:bg-page"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <span className="font-jost text-[14px] font-medium text-ink">
            {view === 'week' ? weekHeading : monthHeading}
          </span>
          {view === 'week' && (
            <button
              onClick={goToday}
              className="rounded-[10px] border border-line px-2.5 py-1 font-jost text-[11px] uppercase tracking-[0.08em] text-ink-2 transition hover:bg-page"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => (view === 'week' ? goWeek(1) : goMonth(1))}
          aria-label="Next"
          className="rounded-[10px] border border-line bg-surface px-3 py-1.5 font-jost text-sm text-ink-2 transition hover:bg-page"
        >
          →
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-danger/20 bg-danger/[0.06] px-4 py-3 font-jost text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-line" />
          ))}
        </div>
      ) : view === 'week' ? (
        <>
          {/* Desktop: 7 day columns. Phone: vertical day-scroller (stacked
              sections) — same data, no horizontal squeeze. */}
          <div className="hidden gap-2 sm:grid sm:grid-cols-7">
            {weekDays.map((d) => {
              const dayBookings = byDay.get(d.ymd) ?? [];
              const isToday = d.ymd === todayYMD;
              return (
                <div
                  key={d.ymd}
                  className={`min-h-[10rem] rounded-xl border p-2 ${
                    isToday ? 'border-primary/40 bg-primary-soft/40' : 'border-line bg-surface'
                  }`}
                >
                  <p
                    className={`mb-2 text-center font-jost text-[11px] uppercase tracking-[0.1em] ${
                      isToday ? 'font-semibold text-primary' : 'text-ink-3'
                    }`}
                  >
                    {d.label} {d.dayNum}
                  </p>
                  <div className="space-y-1.5">
                    {dayBookings.map((b) => (
                      <BookingBlock key={b.id} b={b} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 sm:hidden">
            {weekDays.map((d) => {
              const dayBookings = byDay.get(d.ymd) ?? [];
              const isToday = d.ymd === todayYMD;
              return (
                <div key={d.ymd} className="flex gap-3">
                  {/* Day chip — the L2 availability grammar, echoed. */}
                  <div
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border font-jost ${
                      isToday
                        ? 'border-primary bg-primary text-white'
                        : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-[0.08em]">{d.label}</span>
                    <span className="text-[15px] font-semibold leading-none">{d.dayNum}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {dayBookings.length === 0 ? (
                      <p className="pt-3 font-jost text-[12px] font-light text-ink-3/60">—</p>
                    ) : (
                      dayBookings.map((b) => <BookingBlock key={b.id} b={b} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DAY_LABELS.map((l) => (
              <p
                key={l}
                className="text-center font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3"
              >
                {l}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell, i) =>
              cell === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <button
                  key={cell.ymd}
                  onClick={() => {
                    setWeekStart(mondayOf(new Date(`${cell.ymd}T00:00:00.000Z`)));
                    setView('week');
                  }}
                  className={`flex min-h-[3.5rem] flex-col items-center rounded-[10px] border p-1.5 transition hover:border-primary/50 ${
                    cell.ymd === todayYMD
                      ? 'border-primary/40 bg-primary-soft/40'
                      : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`font-jost text-[12px] ${
                      cell.ymd === todayYMD ? 'font-semibold text-primary' : 'text-ink-2'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.count > 0 && (
                    <span className="mt-1 flex gap-0.5">
                      {Array.from({ length: Math.min(cell.count, 3) }, (_, j) => (
                        <span key={j} className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ))}
                      {cell.count > 3 && (
                        <span className="font-jost text-[9px] text-primary">+{cell.count - 3}</span>
                      )}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
          <p className="mt-3 text-center font-jost text-[11px] font-light text-ink-3">
            Tap a day to open its week.
          </p>
        </div>
      )}
    </div>
  );
}
