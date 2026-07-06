'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Job {
  id: string;
  clientName: string;
  address: string;
  fullAddress?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  serviceType: string;
  cleanerEarnings: number;
  viewerEarnings: number | null;
  status: string; // lowercase
  duration: number;
}

const LIFECYCLE_ACTION: Record<string, { label: string; next: string } | undefined> = {
  accepted: { label: "I'm on my way", next: 'EN_ROUTE' },
  confirmed: { label: "I'm on my way", next: 'EN_ROUTE' },
  en_route: { label: 'Start', next: 'IN_PROGRESS' },
  in_progress: { label: 'Complete', next: 'COMPLETED' },
};

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  return isoOf(new Date());
}
function pay(job: Job): number {
  return job.viewerEarnings ?? job.cleanerEarnings;
}
function startsInLabel(dateIso: string, time: string): string | null {
  const [h, m] = time.split(':').map(Number);
  const start = new Date(`${dateIso}T00:00:00`);
  start.setHours(h || 0, m || 0, 0, 0);
  const diffMs = start.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Starts in ${mins} min`;
  return `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function serviceLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [view, setView] = useState<'today' | 'week'>('today');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchJobs = useCallback(async () => {
    setRefreshing(true);
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
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const today = todayIso();
  const todayJobs = useMemo(
    () => jobs.filter((j) => j.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [jobs, today]
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
    setProcessingId(job.id);
    setActionError('');
    try {
      const res = await fetch(`/api/cleaner/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action.next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) await fetchJobs();
      else setActionError(data?.error || 'Could not update the job.');
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
        <h1 className="font-newsreader text-xl font-semibold text-ink">Couldn&apos;t load your jobs</h1>
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

  return (
    <div>
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">
            {loading
              ? 'Your day'
              : todayJobs.length === 0
                ? 'No jobs today'
                : `You have ${todayJobs.length} job${todayJobs.length === 1 ? '' : 's'} today`}
          </h1>
          <button
            type="button"
            onClick={() => fetchJobs()}
            aria-label="Refresh"
            className="mt-1 shrink-0 rounded-full border border-line bg-surface px-3 py-1 font-jost text-[12px] font-medium text-ink-2"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5">
          {(['today', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
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
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-line" />
          ))}
        </div>
      ) : view === 'today' ? (
        todayJobs.length > 0 ? (
          <div className="space-y-3">
            {todayJobs.map((job, i) => (
              <JobRow
                key={job.id}
                job={job}
                highlightCountdown={i === 0}
                now={now}
                processing={processingId === job.id}
                onAdvance={() => advance(job)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-jost text-sm text-ink-2">No jobs scheduled for today.</p>
            <Link
              href="/cleaner/availability"
              className="mt-3 inline-block rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white"
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
                className={`mb-2 font-newsreader text-base font-semibold ${
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
                  {d.jobs.map((job) => (
                    <JobRow key={job.id} job={job} now={now} processing={false} onAdvance={() => {}} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-6 rounded-xl bg-primary-soft px-5 py-3 text-center">
          <p className="font-jost text-sm text-ink-2">
            This week:{' '}
            <span className="font-medium text-ink">£{weekSummary.earned.toFixed(2)} earned</span> ·{' '}
            {weekSummary.count} job{weekSummary.count === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  highlightCountdown,
  now,
  processing,
  onAdvance,
}: {
  job: Job;
  highlightCountdown?: boolean;
  now: number;
  processing: boolean;
  onAdvance: () => void;
}) {
  const action = LIFECYCLE_ACTION[job.status];
  void now; // referenced so the row re-renders on the countdown tick
  const countdown = highlightCountdown ? startsInLabel(job.date, job.time) : null;
  const mapsHref = `https://maps.apple.com/?q=${encodeURIComponent(job.fullAddress || job.address)}`;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-newsreader text-lg font-semibold text-ink">
            {job.time} · {job.clientName}
          </p>
          <a href={mapsHref} className="mt-0.5 block truncate font-jost text-sm text-primary underline">
            {job.address}
          </a>
          <p className="mt-1 font-jost text-[13px] text-ink-3">
            {serviceLabel(job.serviceType)} · {job.duration}h
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-newsreader text-lg font-medium text-ink">£{pay(job).toFixed(2)}</p>
          <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
            {job.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {countdown && <p className="mt-2 font-jost text-[12px] font-medium text-primary">{countdown}</p>}

      <div className="mt-3 flex items-center gap-2">
        {action && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={processing}
            className="flex-1 rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {processing ? 'Updating…' : action.label}
          </button>
        )}
        <Link
          href={`/messages?bookingId=${job.id}`}
          className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2"
        >
          Message
        </Link>
      </div>
    </div>
  );
}
