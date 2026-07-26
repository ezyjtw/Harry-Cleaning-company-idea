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
  // R1-A: SCHEDULED occurrence of a recurring agreement — rendered as a
  // blocked slot labelled "Regular client", not a clickable job.
  isRegular?: boolean;
}

// H56 polish: per-day ghost availability — the cleaner's own remaining open
// ranges (H34's computeCleanerOpenRanges core, bookings subtracted server-side).
interface CalendarDayInfo {
  openRanges: { start: string; end: string }[];
  hasBaseSlots: boolean;
  fullDayBlocked: boolean;
}

// £ without noise: whole pounds stay whole ("£88"), pennies show when real.
function fmtPounds(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
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
  const [days, setDays] = useState<Record<string, CalendarDayInfo>>({});
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
        if (!cancelled) {
          setBookings(d.bookings || []);
          setDays(d.days || {});
        }
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

  const BookingBlock = ({ b }: { b: CalendarBooking }) => {
    // R1-A: SCHEDULED occurrences are slot-blockers, not jobs — no deep link
    // (they're hidden from the Jobs surface by law), a "Regular client" label
    // instead of workflow affordances.
    if (b.isRegular) {
      return (
        <div className="block space-y-1 rounded-[10px] border border-primary/20 bg-primary-soft p-3">
          <p className="font-jost text-[13px] font-medium text-primary">
            {b.startTime} · {b.duration}h
          </p>
          <p className="truncate font-jost text-[12px] text-ink">
            {b.customerFirstName} · {serviceLabelFromSlug(b.serviceType)}
          </p>
          <p className="font-jost text-[11px] font-light text-ink-3">
            Regular client{b.postcodeArea && ` · ${b.postcodeArea}`}
          </p>
        </div>
      );
    }
    return (
      <NavLink
        surface="cleaner-calendar"
        href={`/cleaner/jobs?tab=${JOBS_TAB_FOR_STATUS[b.status] ?? 'pending'}#job-${b.id}`}
        className="block space-y-1 rounded-[10px] border border-primary/20 bg-primary-soft p-3 transition hover:border-primary/50"
      >
        <p className="font-jost text-[13px] font-medium text-primary">
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
  };

  // Ghost availability slot — the "open for work" fill on days without (or
  // around) bookings. Faint, dashed, never clickable: it's context, not a CTA.
  const GhostSlot = ({ r }: { r: { start: string; end: string } }) => (
    <div className="rounded-[10px] border border-dashed border-line px-3 py-2 font-jost text-[11px] font-light text-ink-3">
      Available {r.start}–{r.end}
    </div>
  );

  // Day summary for column headers: jobs+£ on work days, Available/Off
  // otherwise. Past days stay quiet — yesterday's openness is not a fact worth
  // asserting either way.
  // R1-A (amended, James-ruled): SCHEDULED occurrences are uncharged until
  // Phase B's T-48h charge, so their money NEVER rides the headline figure —
  // it's shown separately as "scheduled" (F9's honesty law, cleaner-side).
  const daySummary = (ymd: string, dayBookings: CalendarBooking[]): string => {
    if (dayBookings.length > 0) {
      const confirmed = dayBookings.filter((b) => !b.isRegular);
      const scheduled = dayBookings.filter((b) => b.isRegular);
      const parts: string[] = [];
      if (confirmed.length > 0) {
        const net = confirmed.reduce((s, b) => s + b.earnings, 0);
        return [
          `${confirmed.length} job${confirmed.length > 1 ? 's' : ''} · £${fmtPounds(net)}`,
          ...(scheduled.length > 0
            ? [`£${fmtPounds(scheduled.reduce((s, b) => s + b.earnings, 0))} scheduled`]
            : []),
        ].join(' · ');
      }
      if (scheduled.length > 0) {
        parts.push(`£${fmtPounds(scheduled.reduce((s, b) => s + b.earnings, 0))} scheduled`);
      }
      return parts.join(' · ');
    }
    if (ymd < todayYMD) return '—';
    const info = days[ymd];
    return info && info.openRanges.length > 0 ? 'Available' : 'Off';
  };

  // The week summary bar — the numbers cleaners actually care about (net-first).
  // R1-A (amended): confirmed money leads; scheduled (uncharged) money is a
  // separate figure, never folded into "expected".
  const weekSummary = useMemo(() => {
    const weekBookings = weekDays.flatMap((d) => byDay.get(d.ymd) ?? []);
    const confirmed = weekBookings.filter((b) => !b.isRegular);
    const scheduled = weekBookings.filter((b) => b.isRegular);
    const jobs = confirmed.length;
    const hrs = confirmed.reduce((s, b) => s + b.duration, 0);
    const net = confirmed.reduce((s, b) => s + b.earnings, 0);
    const scheduledNet = scheduled.reduce((s, b) => s + b.earnings, 0);
    return {
      jobs,
      hrs: Number(hrs.toFixed(1)),
      net,
      scheduledCount: scheduled.length,
      scheduledNet,
    };
  }, [weekDays, byDay]);

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
          {/* Week summary bar — the week's story in one line. */}
          <div className="mb-3 rounded-xl border border-line bg-surface px-4 py-2.5 font-jost text-[13px] text-ink-2">
            This week:{' '}
            {weekSummary.jobs === 0 ? (
              <span className="font-medium text-ink">no jobs booked</span>
            ) : (
              <span className="font-medium text-ink">
                {weekSummary.jobs} job{weekSummary.jobs > 1 ? 's' : ''} · {weekSummary.hrs} hrs · £
                {fmtPounds(weekSummary.net)} expected
              </span>
            )}
            {/* R1-A (amended): scheduled regulars are UNCHARGED until T-48h —
                their money reads separately, never as earned/expected. */}
            {weekSummary.scheduledCount > 0 && (
              <span className="font-light text-ink-3">
                {' '}
                · £{fmtPounds(weekSummary.scheduledNet)} scheduled (regular clients, not yet
                charged)
              </span>
            )}
          </div>

          {/* Desktop: 7 day columns. Phone: vertical day-scroller (stacked
              sections) — same data, no horizontal squeeze. */}
          <div className="hidden gap-2 sm:grid sm:grid-cols-7">
            {weekDays.map((d) => {
              const dayBookings = byDay.get(d.ymd) ?? [];
              const isToday = d.ymd === todayYMD;
              const isPast = d.ymd < todayYMD;
              const info = days[d.ymd];
              const ghosts = !isPast ? (info?.openRanges ?? []) : [];
              return (
                <div
                  key={d.ymd}
                  className={`min-h-[10rem] rounded-xl border p-2 ${
                    isToday ? 'border-primary/40 bg-primary-soft/40' : 'border-line bg-surface'
                  }`}
                >
                  <p
                    className={`text-center font-jost text-[11px] uppercase tracking-[0.1em] ${
                      isToday ? 'font-semibold text-primary' : 'text-ink-3'
                    }`}
                  >
                    {d.label} {d.dayNum}
                  </p>
                  {/* Day summary line — the top row alone tells the week. */}
                  <p
                    className={`mb-2 mt-0.5 text-center font-jost text-[10px] font-light ${
                      dayBookings.length > 0 ? 'text-ink-2' : 'text-ink-3/80'
                    }`}
                  >
                    {daySummary(d.ymd, dayBookings)}
                  </p>
                  <div className="space-y-1.5">
                    {dayBookings.map((b) => (
                      <BookingBlock key={b.id} b={b} />
                    ))}
                    {/* Ghost fill: remaining open time reads "open for work". */}
                    {ghosts.map((r, i) => (
                      <GhostSlot key={`${d.ymd}-g${i}`} r={r} />
                    ))}
                    {!isPast && dayBookings.length === 0 && ghosts.length === 0 && (
                      <p className="pt-1 text-center font-jost text-[11px] font-light text-ink-3/70">
                        Not available
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 sm:hidden">
            {weekDays.map((d) => {
              const dayBookings = byDay.get(d.ymd) ?? [];
              const isToday = d.ymd === todayYMD;
              const isPast = d.ymd < todayYMD;
              const info = days[d.ymd];
              const ghosts = !isPast ? (info?.openRanges ?? []) : [];
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
                    {dayBookings.map((b) => (
                      <BookingBlock key={b.id} b={b} />
                    ))}
                    {ghosts.map((r, i) => (
                      <GhostSlot key={`${d.ymd}-g${i}`} r={r} />
                    ))}
                    {dayBookings.length === 0 && ghosts.length === 0 && (
                      <p className="pt-3 font-jost text-[12px] font-light text-ink-3/60">
                        {isPast ? '—' : 'Not available'}
                      </p>
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
