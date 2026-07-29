'use client';

// B1 (James-ruled L2 agenda): one scrolling list grouped by day, reusing the
// SAME JobCard + lifecycle actions as Today (shared module — no drift
// possible). Pending offers surface at the top as offer cards linking to
// /app/offer/[id]. Two chips: Upcoming / Done. The portal jobs page is
// untouched for browsers — the native tab bar points here in-shell.

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type AppJob as Job,
  JobCard,
  LIFECYCLE_ACTION,
  OfferCard,
  haptic,
  isoOf,
} from '@/components/app/job-cards';
import ArrangementRequests from '@/components/cleaner/ArrangementRequests';

type Filter = 'upcoming' | 'done';

const UPCOMING_STATUSES = 'AWAITING_CLEANER,ACCEPTED,CONFIRMED,EN_ROUTE,IN_PROGRESS';
const DONE_STATUSES = 'COMPLETED,REVIEWED';

function dayLabel(iso: string): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (iso === isoOf(today)) return 'Today';
  if (iso === isoOf(tomorrow)) return 'Tomorrow';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

export default function AppJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const fetchJobs = useCallback(async (f: Filter) => {
    try {
      const statuses = f === 'upcoming' ? UPCOMING_STATUSES : DONE_STATUSES;
      const res = await fetch(`/api/cleaner/jobs?status=${statuses}&limit=100`);
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
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs(filter);
  }, [fetchJobs, filter]);

  // Freshness: focus/visibility refetch + the shell's pull-to-refresh hook —
  // identical pattern to Today.
  useEffect(() => {
    const onFocus = () => fetchJobs(filter);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchJobs(filter);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    (window as unknown as { __renaRefresh?: () => void }).__renaRefresh = () => fetchJobs(filter);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      delete (window as unknown as { __renaRefresh?: () => void }).__renaRefresh;
    };
  }, [fetchJobs, filter]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Offers (live AWAITING_CLEANER) float to the top; everything else groups by day.
  const offers = useMemo(() => jobs.filter((j) => j.status === 'awaiting_cleaner'), [jobs]);
  const byDay = useMemo(() => {
    const rest = jobs
      .filter((j) => j.status !== 'awaiting_cleaner')
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) * (filter === 'done' ? -1 : 1) ||
          a.time.localeCompare(b.time)
      );
    const groups: { iso: string; jobs: Job[] }[] = [];
    for (const j of rest) {
      const g = groups.find((x) => x.iso === j.date);
      if (g) g.jobs.push(j);
      else groups.push({ iso: j.date, jobs: [j] });
    }
    return groups;
  }, [jobs, filter]);

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
        await fetchJobs(filter);
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

  if (!loading && loadError && jobs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-newsreader text-xl font-semibold text-ink">
          Couldn&apos;t load your jobs
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchJobs(filter);
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
      <header className="mb-5">
        <h1 className="font-newsreader text-[26px] font-semibold leading-tight text-ink">Jobs</h1>
        <div className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5">
          {(['upcoming', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                haptic('light');
                setFilter(f);
              }}
              className={`rounded-full px-4 py-1.5 font-jost text-sm font-medium transition-colors ${
                filter === f ? 'bg-primary text-white' : 'text-ink-2'
              }`}
            >
              {f === 'upcoming' ? 'Upcoming' : 'Done'}
            </button>
          ))}
        </div>
      </header>

      {actionError && (
        <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{actionError}</p>
        </div>
      )}

      {/* F27: regular arrangement request cards — same canonical surface as
          the web jobs list, above everything and independent of the filter
          chips, so a live request can never be hidden by view state. */}
      <ArrangementRequests variant="app" className="mb-5" onResolved={() => fetchJobs(filter)} />

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : (
        <div className="space-y-5">
          {filter === 'upcoming' && offers.length > 0 && (
            <div className="space-y-3">
              {offers.map((o) => (
                <OfferCard key={o.id} job={o} />
              ))}
            </div>
          )}

          {byDay.length === 0 && offers.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center">
              <p className="font-jost text-sm text-ink-2">
                {filter === 'upcoming'
                  ? 'No upcoming jobs — new offers will appear here.'
                  : 'No completed jobs yet.'}
              </p>
            </div>
          )}

          {byDay.map((d) => (
            <div key={d.iso}>
              <h2
                className={`mb-2 font-newsreader text-base font-semibold ${
                  d.iso === isoOf(new Date()) ? 'text-primary' : 'text-ink'
                }`}
              >
                {dayLabel(d.iso)}
              </h2>
              <div className="space-y-3">
                {d.jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    now={now}
                    processing={processingId === job.id}
                    onAdvance={() => advance(job)}
                    onCancelled={() => fetchJobs(filter)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
