'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import HiddenProfileBanner from '@/components/app/HiddenProfileBanner';
import InboxBell from '@/components/app/InboxBell';
import {
  type AppJob as Job,
  HeroJob,
  JobCard,
  LIFECYCLE_ACTION,
  ReceiptRow,
  haptic,
  isoOf,
  pay,
} from '@/components/app/job-cards';

function dateEyebrow(): string {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

// ─── Day-one first-run states (James-ruled) ──────────────────────────────────
// A cleaner who has NEVER had a job gets a purpose-built Today instead of
// "Day off": State 1 (no availability set — "Almost there") or State 2
// (available, nothing booked ever — "Ready for work"). The has-worked probe
// checks COMPLETED and REVIEWED — completed jobs become REVIEWED after a
// customer review, which the page's main fetch doesn't include — so an
// established cleaner's quiet day keeps the existing Day off screen (State 3)
// untouched. Probes fire only when the jobs list comes back empty, and any
// probe failure falls back to Day off — never a broken screen.
const JS_DAY_TO_API = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

interface FreeRow {
  iso: string;
  label: string;
  hours: string;
}
interface DayOneState {
  state: 1 | 2;
  free: FreeRow[];
}

function fmtSlotTime(t: string): string {
  return t.replace(/^0/, '');
}

// C3: "Day off — next job Thu 10:00" living empty state.
function nextJobLabel(j: Job): string {
  const d = new Date(`${j.date}T00:00:00`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day =
    j.date === isoOf(tomorrow) ? 'tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${day} ${j.time}`;
}

// C3: the earned-today serif ticker — counts up to the day's completed total,
// and counts on from there when another job completes.
function EarnedTicker({ amount }: { amount: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const delta = amount - from;
    if (delta === 0) return;
    const t0 = performance.now();
    const DURATION = 700;
    let raf: number;
    const step = (t: number) => {
      const p = Math.min((t - t0) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + delta * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = amount;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [amount]);
  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3.5">
      <span className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        Today
      </span>
      <span className="font-jost text-xl font-semibold text-teal">£{display.toFixed(2)}</span>
    </div>
  );
}

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [view, setView] = useState<'today' | 'week'>('today');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dayOne, setDayOne] = useState<DayOneState | null>(null);

  // Runs only when the jobs list is empty: decides day-one State 1/2, or null
  // (has worked before → the existing Day off). Fail-open to null on any error.
  const resolveDayOne = useCallback(async (): Promise<DayOneState | null> => {
    try {
      const [workedRes, availRes] = await Promise.all([
        fetch('/api/cleaner/jobs?status=COMPLETED,REVIEWED&limit=1'),
        fetch('/api/cleaner/availability'),
      ]);
      if (!workedRes.ok || !availRes.ok) return null;
      const worked = await workedRes.json().catch(() => null);
      if (!Array.isArray(worked?.jobs) || worked.jobs.length > 0) return null;
      const avail = await availRes.json().catch(() => null);
      if (!avail) return null;
      const weekly: Record<string, { start: string; end: string }[]> = avail.weeklySlots || {};
      const dateSlots: Record<string, { start: string; end: string }[]> = avail.dateSlots || {};
      const blocked = new Set<string>(
        (Array.isArray(avail.blockedDates) ? avail.blockedDates : []).map(
          (b: { date: string }) => b.date
        )
      );
      const hasAvailability =
        Object.values(weekly).some((s) => Array.isArray(s) && s.length > 0) ||
        Object.values(dateSlots).some((s) => Array.isArray(s) && s.length > 0);
      if (!hasAvailability) return { state: 1, free: [] };
      // State 2: her open hours over the rolling next 7 days — date overrides
      // win, blocked days drop out, empty days simply don't appear (honest,
      // no nag line).
      const free: FreeRow[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const iso = isoOf(d);
        if (blocked.has(iso)) continue;
        const slots = dateSlots[iso]?.length
          ? dateSlots[iso]
          : weekly[JS_DAY_TO_API[d.getDay()]] || [];
        if (!slots.length) continue;
        const label =
          i === 0
            ? 'Today'
            : i === 1
              ? 'Tomorrow'
              : d.toLocaleDateString('en-GB', { weekday: 'long' });
        free.push({
          iso,
          label,
          hours: slots.map((s) => `${fmtSlotTime(s.start)}–${fmtSlotTime(s.end)}`).join(', '),
        });
      }
      return { state: 2, free };
    } catch {
      return null;
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(
        '/api/cleaner/jobs?status=ACCEPTED,CONFIRMED,EN_ROUTE,IN_PROGRESS,COMPLETED&limit=50'
      );
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      const list: Job[] = Array.isArray(data?.jobs) ? data.jobs : [];
      // Day-one discriminator resolves BEFORE loading clears so the first
      // paint is already the right state (no Day-off flash). It re-runs on
      // every refetch, so setting availability flips State 1 → 2 on the next
      // focus, and a first booking clears day-one entirely.
      setDayOne(list.length === 0 ? await resolveDayOne() : null);
      setJobs(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [resolveDayOne]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Freshness: refetch when the app/tab regains focus or becomes visible (a
  // cleaner switching back from Maps/messages sees current jobs), and expose a
  // refetch the native shell's pull-to-refresh can call via injected JS.
  useEffect(() => {
    const onFocus = () => fetchJobs();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchJobs();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    (window as unknown as { __renaRefresh?: () => void }).__renaRefresh = fetchJobs;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      delete (window as unknown as { __renaRefresh?: () => void }).__renaRefresh;
    };
  }, [fetchJobs]);

  // Live-ticking next-job countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const today = isoOf(new Date());
  const todayJobs = useMemo(
    () => jobs.filter((j) => j.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [jobs, today]
  );
  // C3: the day splits into what's still to do and the receipts of what's done.
  const activeToday = useMemo(
    () => todayJobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled'),
    [todayJobs]
  );
  const doneToday = useMemo(() => todayJobs.filter((j) => j.status === 'completed'), [todayJobs]);
  const earnedToday = useMemo(() => doneToday.reduce((s, j) => s + pay(j), 0), [doneToday]);
  const nextUpcoming = useMemo(() => {
    return jobs
      .filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
      .map((j) => ({ j, start: new Date(`${j.date}T${j.time}:00`).getTime() }))
      .filter((x) => !Number.isNaN(x.start) && x.start > now)
      .sort((a, b) => a.start - b.start)[0]?.j;
  }, [jobs, now]);

  // W1 (James-ruled): the day's rhythm. Morning = jobs exist, none started —
  // the preview. Evening = last job completed (earned-based, never clock-based)
  // — the flip. The live-day view between them is untouched.
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoOf(d);
  }, []);
  const morning = useMemo(
    () =>
      !loading &&
      activeToday.length > 0 &&
      doneToday.length === 0 &&
      todayJobs.every((j) => j.status === 'accepted' || j.status === 'confirmed'),
    [loading, activeToday, doneToday, todayJobs]
  );
  const evening = useMemo(
    () => !loading && todayJobs.length > 0 && activeToday.length === 0 && doneToday.length > 0,
    [loading, todayJobs, activeToday, doneToday]
  );
  const expectedToday = useMemo(
    () => todayJobs.filter((j) => j.status !== 'cancelled').reduce((s, j) => s + pay(j), 0),
    [todayJobs]
  );
  const tomorrowFirst = useMemo(
    () =>
      jobs
        .filter(
          (j) => j.date === tomorrowIso && j.status !== 'completed' && j.status !== 'cancelled'
        )
        .sort((a, b) => a.time.localeCompare(b.time))[0],
    [jobs, tomorrowIso]
  );

  const weekByDay = useMemo(() => {
    const days: { iso: string; label: string; isToday: boolean; jobs: Job[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = isoOf(d);
      const label =
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
      days.push({
        iso,
        label,
        isToday: i === 0,
        jobs: jobs.filter((j) => j.date === iso).sort((a, b) => a.time.localeCompare(b.time)),
      });
    }
    return days;
  }, [jobs]);

  const weekSummary = useMemo(() => {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const inWeek = jobs.filter(
      (j) => new Date(`${j.date}T00:00:00`) >= monday && j.status === 'completed'
    );
    return { earned: inWeek.reduce((s, j) => s + pay(j), 0), count: inWeek.length };
  }, [jobs]);

  const advance = async (job: Job) => {
    const action = LIFECYCLE_ACTION[job.status];
    if (!action) return;
    haptic('medium');
    setProcessingId(job.id);
    setActionError('');
    try {
      const res = await fetch(`/api/cleaner/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action.next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        haptic('success');
        await fetchJobs();
      } else {
        haptic('error');
        setActionError(data?.error || 'Could not update the job.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/10 px-5 py-4">
        <p className="text-sm font-medium text-danger">Please sign in to see your jobs.</p>
      </div>
    );
  }

  // Full error state (retry) — only when we have nothing to show.
  if (!loading && loadError && jobs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-jost text-xl font-semibold text-ink">Couldn&apos;t load your jobs</h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchJobs();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Day-one states 1 & 2 (James-ruled). State 3 — has worked before — is
  // the existing Day off rendering below, untouched, footer included. ─────────
  if (!loading && dayOne?.state === 1) {
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        <header className="mb-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {dateEyebrow()}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
              Almost there
            </h1>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <AccountMenu />
              <InboxBell />
            </div>
          </div>
        </header>
        <div
          className="flex flex-col items-center px-6 pt-12 text-center"
          data-testid="day-one-set-availability"
        >
          <svg
            className="h-10 w-10 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <p className="mt-4 font-jost text-lg font-semibold text-ink">Nobody can book you yet</p>
          <p className="mt-1.5 font-jost text-sm text-ink-2">
            Set the hours you&apos;re free and jobs in your area will start finding you.
          </p>
          <Link
            href="/app/availability"
            onClick={() => haptic('light')}
            className="mt-6 inline-block rounded-[10px] bg-primary px-5 py-2.5 font-jost text-sm font-medium text-white"
          >
            Set your availability
          </Link>
        </div>
      </div>
    );
  }
  if (!loading && dayOne?.state === 2) {
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        <header className="mb-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {dateEyebrow()}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
              Ready for work
            </h1>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <AccountMenu />
              <InboxBell />
            </div>
          </div>
          <p className="mt-1.5 font-jost text-sm text-ink-2">
            Nothing booked yet — offers land here as they come.
          </p>
        </header>
        {dayOne.free.length > 0 && (
          <div data-testid="day-one-free-week">
            <p className="mb-1.5 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              You&apos;re free this week
            </p>
            <div className="divide-y divide-line/60 rounded-2xl border border-line bg-surface px-4">
              {dayOne.free.map((r) => (
                <div key={r.iso} className="flex items-baseline justify-between py-3">
                  <span className="font-jost text-sm font-medium text-ink">{r.label}</span>
                  <span className="font-jost text-sm text-ink-2">{r.hours}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* F26 app-scope ruling: banner-only hidden-state parity, F26.1 copy. */}
      <HiddenProfileBanner className="mb-4" />
      <header className="mb-5">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {dateEyebrow()}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
            {loading
              ? 'Your Day'
              : todayJobs.length === 0
                ? 'Day Off'
                : evening
                  ? 'All Done'
                  : activeToday.length === 0
                    ? 'All Done'
                    : `${activeToday.length} Job${activeToday.length === 1 ? '' : 's'} Today`}
          </h1>
          {/* A5: the Refresh pill is gone — pull-to-refresh (__renaRefresh) and
              the focus/visibility refetch make it redundant. W2: the bell is
              the shared header component now, dot included. */}
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <AccountMenu />
            <InboxBell />
          </div>
        </div>
        {morning && (
          <p className="mt-1.5 font-jost text-sm text-ink-2" data-testid="morning-preview">
            First Job {todayJobs[0]?.time} · £{expectedToday.toFixed(2)} Expected
          </p>
        )}
        {evening && (
          <p className="mt-1.5 font-jost text-sm text-ink-2" data-testid="evening-flip">
            {tomorrowFirst
              ? `Tomorrow: ${tomorrowFirst.time} · ${tomorrowFirst.clientName}`
              : 'Nothing booked tomorrow yet — keep your availability fresh.'}
          </p>
        )}
        <div className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5">
          {(['today', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                haptic('light');
                setView(v);
              }}
              className={`rounded-full px-4 py-1.5 font-jost text-sm font-medium transition-colors ${
                view === v ? 'bg-primary text-white' : 'text-ink-2'
              }`}
            >
              {v === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      </header>

      {actionError && (
        <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{actionError}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-44 animate-pulse rounded-2xl bg-line" />
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : view === 'today' ? (
        todayJobs.length > 0 ? (
          <div>
            <div className="space-y-3">
              {activeToday.map((job, i) =>
                i === 0 ? (
                  <HeroJob
                    key={job.id}
                    job={job}
                    now={now}
                    processing={processingId === job.id}
                    onAdvance={() => advance(job)}
                    onCancelled={fetchJobs}
                  />
                ) : (
                  <JobCard
                    key={job.id}
                    job={job}
                    now={now}
                    processing={processingId === job.id}
                    onAdvance={() => advance(job)}
                    onCancelled={fetchJobs}
                  />
                )
              )}
            </div>
            {/* C3: completed jobs collapse to single-line receipts */}
            {doneToday.length > 0 && (
              <div className={activeToday.length > 0 ? 'mt-5' : ''}>
                <p className="mb-1.5 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                  Done today
                </p>
                <div className="rounded-2xl border border-line bg-surface px-4 py-1">
                  {doneToday.map((job) => (
                    <ReceiptRow key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* C3: living empty state — the day off still tells you what's next */
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="font-jost text-lg font-semibold text-ink">
              {nextUpcoming ? `Next Job ${nextJobLabel(nextUpcoming)}` : 'Nothing Booked Yet'}
            </p>
            <p className="mt-1 font-jost text-sm text-ink-2">
              {nextUpcoming
                ? `${nextUpcoming.clientName} · ${nextUpcoming.address}`
                : 'Keep your availability fresh so offers can find you.'}
            </p>
            <Link
              href="/app/availability"
              onClick={() => haptic('light')}
              className="mt-4 inline-block rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white"
            >
              Update your availability
            </Link>
          </div>
        )
      ) : (
        <div className="space-y-5">
          {weekByDay.map((d) => (
            <div key={d.iso}>
              <h2
                className={`mb-2 font-jost text-base font-semibold ${
                  d.isToday ? 'text-primary' : 'text-ink'
                }`}
              >
                {d.label}
                {d.isToday && d.jobs.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 align-middle font-jost text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                    {d.jobs.length}
                  </span>
                )}
              </h2>
              {d.jobs.length === 0 ? (
                <p className="font-jost text-sm font-light text-ink-3/70">No jobs</p>
              ) : (
                <div className="space-y-3">
                  {d.jobs
                    .filter((job) => job.status !== 'completed')
                    .map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        now={now}
                        processing={false}
                        onAdvance={() => {}}
                      />
                    ))}
                  {d.jobs.some((job) => job.status === 'completed') && (
                    <div className="rounded-2xl border border-line bg-surface px-4 py-1">
                      {d.jobs
                        .filter((job) => job.status === 'completed')
                        .map((job) => (
                          <ReceiptRow key={job.id} job={job} />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pro Navy law: the earned ticker is the bottom row — TODAY caps left,
          bold money right, still counting. */}
      {!loading && earnedToday > 0 && <EarnedTicker amount={earnedToday} />}
      {!loading && (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3.5 text-center">
          <span className="font-jost text-[12px] uppercase tracking-[0.12em] text-ink-3">
            This week
          </span>
          <span className="font-jost text-xl font-semibold text-teal">
            £{weekSummary.earned.toFixed(2)}
          </span>
          <span className="font-jost text-[13px] text-ink-3">
            · {weekSummary.count} job{weekSummary.count === 1 ? '' : 's'}
          </span>
        </div>
      )}
    </div>
  );
}
