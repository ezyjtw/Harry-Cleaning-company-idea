'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';

import ArrangementRequests from '@/components/cleaner/ArrangementRequests';
import CleanerStatusChip from '@/components/cleaner/CleanerStatusChip';
import RegularCleanChip from '@/components/cleaner/RegularCleanChip';
import { bedroomsLabel, serviceLabelFromSlug } from '@/lib/constants/services';

// 4.6 (James-ruled): EN_ROUTE and IN_PROGRESS collapse to one cleaner-visible
// "On the way" state; legacy in-flight rows render there too.
type JobStatus = 'pending' | 'upcoming' | 'on-the-way' | 'completed';

interface Job {
  id: string;
  clientName: string;
  address: string;
  fullAddress: string;
  date: string;
  time: string;
  serviceType: string;
  cleanerEarnings: number;
  status: string;
  duration: number;
  notes?: string;
  cleanerNotes?: string;
  bedrooms?: number;
  extras?: string[];
  // F24.1: non-null = a recurring occurrence (WEEKLY | FORTNIGHTLY).
  recurringFrequency?: string | null;
  cascadePhase?: string | null;
  isPrimary?: boolean;
  isProvisional?: boolean;
  isReserve?: boolean;
  viewerEarnings?: number | null;
}

const statusMap: Record<string, JobStatus> = {
  pending: 'pending',
  awaiting_cleaner: 'pending',
  confirmed: 'pending',
  accepted: 'upcoming',
  en_route: 'on-the-way',
  in_progress: 'on-the-way',
  completed: 'completed',
  reviewed: 'completed',
};

function toDisplayStatus(apiStatus: string): JobStatus {
  return statusMap[apiStatus.toLowerCase()] || 'pending';
}

// Map display status back to API statuses for filtering
function toApiStatuses(displayStatus: JobStatus): string[] {
  switch (displayStatus) {
    case 'pending':
      return ['PENDING', 'AWAITING_CLEANER', 'CONFIRMED'];
    case 'upcoming':
      return ['ACCEPTED'];
    case 'on-the-way':
      return ['EN_ROUTE', 'IN_PROGRESS'];
    case 'completed':
      return ['COMPLETED', 'REVIEWED'];
  }
}

const tabs: { key: JobStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'on-the-way', label: 'On the way' },
  { key: 'completed', label: 'Completed' },
];

const LIFECYCLE_STEPS: { key: JobStatus; label: string }[] = [
  { key: 'upcoming', label: 'Accepted' },
  { key: 'on-the-way', label: 'On the way' },
  { key: 'completed', label: 'Completed' },
];

const emptyMessages: Record<JobStatus, { title: string; description: string }> = {
  pending: { title: 'No pending jobs', description: 'You have no jobs waiting for your response.' },
  upcoming: { title: 'No upcoming jobs', description: 'You have no confirmed upcoming jobs.' },
  'on-the-way': {
    title: 'No jobs on the way',
    description: 'Jobs appear here after you tap "On my way".',
  },
  completed: { title: 'No completed jobs', description: 'Your completed jobs will appear here.' },
};

// API status to transition target
const transitionMap: Record<JobStatus, string> = {
  pending: 'ACCEPTED',
  upcoming: 'EN_ROUTE',
  'on-the-way': 'COMPLETED',
  completed: '',
};

export default function CleanerJobsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<JobStatus>('pending');
  const [jobList, setJobList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<JobStatus, number>>({
    pending: 0,
    upcoming: 0,
    'on-the-way': 0,
    completed: 0,
  });
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
  // H3: "Can't make this job?" — consequences-first confirm, ACCEPTED only.
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  // F16: honest load failure (was a silent blank) + per-action pending.
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // H56: calendar deep-links arrive as ?tab=<tab>#job-<id>. CSS :target can't
  // match content that mounts after navigation, so the highlight is stateful.
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // H56: land on the tab the deep-linked job actually lives on.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && tabs.some((t) => t.key === tab)) setActiveTab(tab as JobStatus);
  }, []);

  // H56: once the list has rendered, scroll the deep-linked card into view and
  // ring it.
  useEffect(() => {
    if (loading) return;
    const m = window.location.hash.match(/^#job-(.+)$/);
    if (!m) return;
    const el = document.getElementById(`job-${m[1]}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    setHighlightId(m[1]);
  }, [loading, jobList]);

  // Stale-response guard: a slower earlier fetch (e.g. the mount-time
  // 'pending' load racing a deep-link tab switch) must not overwrite the
  // latest tab's list.
  const fetchSeq = useRef(0);

  const fetchJobs = useCallback(async (tab: JobStatus) => {
    const seq = ++fetchSeq.current;
    const statuses = toApiStatuses(tab).join(',');
    setLoadError(false);
    try {
      const res = await fetch(`/api/cleaner/jobs?status=${statuses}&limit=50`);
      if (seq !== fetchSeq.current) return;
      if (res.status === 401) {
        // R3: signOut (not router.push) — clears the stale cookie so /login
        // renders instead of middleware bouncing back to /dashboard.
        signOut({ callbackUrl: '/login' });
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      if (seq !== fetchSeq.current) return;
      setJobList(
        data.jobs.map((j: Job) => ({
          ...j,
          status: j.status,
        }))
      );
    } catch {
      if (seq === fetchSeq.current) setLoadError(true);
    }
  }, []);

  // A8 (shell only): native pull-to-refresh hook. RenaPro-UA-gated — inert in
  // a normal browser.
  useEffect(() => {
    if (!/RenaPro/.test(navigator.userAgent)) return;
    const w = window as unknown as { __renaRefresh?: () => void };
    w.__renaRefresh = () => fetchJobs(activeTab);
    return () => {
      delete w.__renaRefresh;
    };
  }, [fetchJobs, activeTab]);

  // Fetch counts for all tabs on mount
  const fetchCounts = useCallback(async () => {
    const allStatuses =
      'PENDING,AWAITING_CLEANER,CONFIRMED,ACCEPTED,EN_ROUTE,IN_PROGRESS,COMPLETED,REVIEWED';
    const res = await fetch(`/api/cleaner/jobs?status=${allStatuses}&limit=200`);
    if (res.status === 401) {
      signOut({ callbackUrl: '/login' });
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    const c: Record<JobStatus, number> = {
      pending: 0,
      upcoming: 0,
      'on-the-way': 0,
      completed: 0,
    };
    for (const j of data.jobs) {
      const ds = toDisplayStatus(j.status);
      c[ds]++;
    }
    setCounts(c);
  }, []);
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    setLoading(true);
    fetchJobs(activeTab).finally(() => setLoading(false));
  }, [activeTab, fetchJobs]);

  const transitionJob = useCallback(
    async (id: string, newDisplayStatus: JobStatus) => {
      setBusyId(id);
      try {
        setError(null);
        const apiStatus = transitionMap[activeTab];
        if (!apiStatus) return;

        const body: Record<string, string> = { status: apiStatus };
        if (newDisplayStatus === 'completed' && completionNotes[id]) {
          body.notes = completionNotes[id];
        }

        const res = await fetch(`/api/cleaner/jobs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          setJobList((prev) => prev.filter((j) => j.id !== id));
          setCounts((prev) => ({
            ...prev,
            [activeTab]: Math.max(0, prev[activeTab] - 1),
            [newDisplayStatus]: prev[newDisplayStatus] + 1,
          }));
          setShowNotesFor(null);
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error || 'Failed to update job status');
        }
      } catch {
        setError('Network error — please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [activeTab, completionNotes]
  );

  // H3: fires the existing cleaner-cancel path — paid bookings flip to
  // CLEANER_CANCELLED and enter the M3 rescue (customer notified immediately,
  // chooses full refund or free rebook).
  const handleCleanerCancel = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/cleaner/jobs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'CANCELLED',
            cancellationReason: cancelReason.trim() || 'Cancelled by cleaner',
          }),
        });
        if (res.ok) {
          setJobList((prev) => prev.filter((j) => j.id !== id));
          setCounts((prev) => ({ ...prev, [activeTab]: Math.max(0, prev[activeTab] - 1) }));
          setCancelFor(null);
          setCancelReason('');
        } else {
          const data = await res.json().catch(() => null);
          setError(data?.error || 'Failed to cancel this job');
        }
      } catch {
        setError('Network error — please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [activeTab, cancelReason]
  );

  const handleDecline = useCallback(
    async (id: string) => {
      setError(null);
      setBusyId(id);
      const res = await fetch(`/api/cleaner/jobs/${id}/decline`, {
        method: 'POST',
      }).finally(() => setBusyId(null));
      if (res.ok) {
        setJobList((prev) => prev.filter((j) => j.id !== id));
        setCounts((prev) => ({
          ...prev,
          [activeTab]: Math.max(0, prev[activeTab] - 1),
        }));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to decline job');
      }
    },
    [activeTab]
  );

  const handleAccept = useCallback(
    async (id: string) => {
      setError(null);
      setBusyId(id);
      const res = await fetch(`/api/cleaner/jobs/${id}/accept`, {
        method: 'POST',
      }).finally(() => setBusyId(null));
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // PROVISIONAL (awaiting approval) and RESERVED (held) stay in the
        // pending tab with their new status — refetch so flags re-render.
        if (data?.outcome === 'PROVISIONAL' || data?.outcome === 'RESERVED') {
          await fetchJobs(activeTab);
          return;
        }
        setJobList((prev) => prev.filter((j) => j.id !== id));
        setCounts((prev) => ({
          ...prev,
          [activeTab]: Math.max(0, prev[activeTab] - 1),
          upcoming: prev.upcoming + 1,
        }));
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to accept job');
      }
    },
    [activeTab, fetchJobs]
  );

  const getStatusBadge = (job: Job) => (
    <CleanerStatusChip
      status={job.status}
      cascadePhase={job.cascadePhase}
      isPrimary={job.isPrimary}
      isProvisional={job.isProvisional}
      isReserve={job.isReserve}
    />
  );

  const getLifecycleStepIndex = (status: string): number => {
    const ds = toDisplayStatus(status);
    return LIFECYCLE_STEPS.findIndex((s) => s.key === ds);
  };

  return (
    <div className="min-h-screen bg-page p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">My Jobs</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Manage your cleaning bookings
        </p>
      </div>

      {/* F27: regular arrangement request cards — ABOVE the tabs so no tab
          state can ever hide a live request (the old availability-tab home
          did exactly that). Accepting mints occurrences, so both the list
          and the tab counts refetch. */}
      <ArrangementRequests
        variant="portal"
        className="mb-6"
        onResolved={() => {
          fetchJobs(activeTab);
          fetchCounts();
        }}
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-line">
        {/* X7: all five tabs VISIBLE on a phone — wrap into rows (the old
            overflow-x-auto strip hid tabs off-screen with no affordance). */}
        <nav className="flex flex-wrap gap-x-5 gap-y-1 -mb-px sm:gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setError(null);
                setActiveTab(tab.key);
              }}
              className={`whitespace-nowrap pb-3 px-1 font-jost text-[11px] uppercase tracking-[0.1em] border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink-2 hover:border-ink/20'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 font-jost text-[10px] ${
                    activeTab === tab.key ? 'bg-primary-soft text-primary' : 'bg-page text-ink-3'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-[10px] bg-danger/10 p-3 font-jost text-sm text-danger">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 font-medium text-danger hover:text-danger/80"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-line" />
          ))}
        </div>
      )}

      {/* F16: honest load failure with Retry (was a silent blank). */}
      {!loading && loadError && (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <h2 className="font-newsreader text-lg font-semibold text-ink">
            Couldn&apos;t load your jobs
          </h2>
          <p className="mt-1 font-jost text-sm text-ink-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchJobs(activeTab).finally(() => setLoading(false));
            }}
            className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Job list */}
      {!loading && !loadError && jobList.length === 0 && (
        <div className="text-center py-16">
          <svg
            className="mx-auto w-12 h-12 text-ink-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-4 font-newsreader text-lg font-semibold text-ink">
            {emptyMessages[activeTab].title}
          </h3>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">
            {emptyMessages[activeTab].description}
          </p>
        </div>
      )}

      {!loading && jobList.length > 0 && (
        <div className="space-y-4">
          {jobList.map((job) => {
            const ds = toDisplayStatus(job.status);
            return (
              // F3: whole-card click target; Message/Accept/Decline and inner
              // links win via the interactive-ancestor guard.
              <div
                key={job.id}
                id={`job-${job.id}`}
                onClick={(e) => {
                  // F15: inputs/textareas (completion notes, cancel reason) and their
                  // panels must WIN over the card click — a tap on them was
                  // bubbling to navigation, so a cleaner couldn't type the note.
                  if (
                    (e.target as HTMLElement).closest(
                      'button, a, input, textarea, select, label, [data-card-interactive]'
                    )
                  )
                    return;
                  router.push(`/cleaner/jobs/${job.id}`);
                }}
                className={`cursor-pointer rounded-xl border border-line bg-surface p-5 transition-colors hover:bg-page/40 target:ring-2 target:ring-primary ${highlightId === job.id ? 'ring-2 ring-primary' : ''}`}
              >
                {/* H104 item 5: click through to the job's home. */}
                <Link
                  href={`/cleaner/jobs/${job.id}`}
                  className="mb-2 inline-block font-jost text-[11px] uppercase tracking-[0.08em] text-primary"
                >
                  View details →
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                        {serviceLabelFromSlug(job.serviceType)}
                      </span>
                      {getStatusBadge(job)}
                      {/* F24.1: recurring occurrences are visibly recurring. */}
                      <RegularCleanChip frequency={job.recurringFrequency} />
                    </div>
                    <p className="font-jost text-sm text-ink">
                      {job.clientName} &middot; {job.date} at {job.time} ({job.duration}h)
                    </p>
                    <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                      {ds === 'pending' ? job.address : job.fullAddress || job.address}
                    </p>
                    {/* 4.6 meta narration — the card states the consequence of
                        the last tap (shared grammar with the app cards). */}
                    {ds === 'on-the-way' && (
                      <p className="mt-1 font-jost text-[12.5px] font-light text-ink-3">
                        {job.clientName}&apos;s been told you&apos;re coming
                      </p>
                    )}
                    {ds === 'completed' && (
                      <p className="mt-1 font-jost text-[12.5px] font-light text-ink-3">
                        £{job.cleanerEarnings.toFixed(2)} releasing to you after the review window
                      </p>
                    )}
                    {job.extras && job.extras.length > 0 && (
                      <p className="mt-1 font-jost text-xs font-light text-ink-3">
                        Add-ons: {job.extras.join(', ')}
                      </p>
                    )}
                    <p className="mt-1 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                      Ref: {job.id.slice(0, 12)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    {job.isProvisional ? (
                      <div className="text-right">
                        <p className="font-newsreader text-2xl font-medium text-ink">
                          &pound;{job.cleanerEarnings.toFixed(2)}
                        </p>
                        <p className="mt-1 font-jost text-xs font-medium text-warning">
                          Provisionally yours — awaiting customer approval
                        </p>
                      </div>
                    ) : !job.isPrimary &&
                      job.viewerEarnings !== null &&
                      job.viewerEarnings !== undefined ? (
                      <div className="text-right">
                        <p className="font-newsreader text-2xl font-medium text-ink">
                          &pound;{job.viewerEarnings.toFixed(2)}
                        </p>
                        {/* F24.3 (amended): one labelled line, no arithmetic —
                            the customer total never renders on this seat. */}
                        <p className="font-jost text-[11px] text-ink-3">You&rsquo;d earn</p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="font-newsreader text-2xl font-medium text-ink">
                          &pound;{job.cleanerEarnings.toFixed(2)}
                        </p>
                        <p className="font-jost text-[11px] text-ink-3">
                          {ds === 'pending' ? 'You\u2019d earn' : 'You receive'}
                        </p>
                      </div>
                    )}

                    {(job.serviceType === 'end-of-tenancy' || job.serviceType === 'airbnb') &&
                      job.bedrooms !== undefined && (
                        <div className="max-w-xs rounded-lg border border-line bg-primary-soft px-4 py-3 text-left">
                          <p className="font-jost text-sm font-medium text-ink">
                            {job.serviceType === 'end-of-tenancy'
                              ? 'End of Tenancy'
                              : 'AirBnB Turnover'}{' '}
                            — {bedroomsLabel(job.bedrooms)}
                          </p>
                          {/* F24.3 (James-amended): fixed-price money renders
                              IDENTICALLY to hourly — one labelled line, no
                              arithmetic, never the customer's total. */}
                          <p
                            className="mt-2 font-jost text-sm font-medium text-primary"
                            data-testid="fixed-breakdown"
                          >
                            {ds === 'pending' ? 'You\u2019d earn' : 'You receive'}: &pound;
                            {(!job.isPrimary &&
                            job.viewerEarnings !== null &&
                            job.viewerEarnings !== undefined
                              ? job.viewerEarnings
                              : job.cleanerEarnings
                            ).toFixed(2)}
                          </p>
                        </div>
                      )}

                    <div className="flex gap-2 flex-wrap justify-end">
                      {!job.isReserve && !job.isProvisional && (
                        <button
                          onClick={() => router.push(`/messages?bookingId=${job.id}`)}
                          className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page"
                        >
                          Message customer
                        </button>
                      )}
                      {job.isReserve && (
                        <p className="font-jost text-xs font-light text-ink-2 text-right max-w-xs">
                          You&apos;re held in reserve. If no cleaner accepts at or below the quoted
                          price, we&apos;ll offer this to you.
                        </p>
                      )}
                      {ds === 'pending' && !job.isProvisional && !job.isReserve && (
                        <>
                          <button
                            onClick={() => handleAccept(job.id)}
                            disabled={busyId === job.id}
                            className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                          >
                            {busyId === job.id ? 'Accepting…' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDecline(job.id)}
                            disabled={busyId === job.id}
                            className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-60"
                          >
                            {busyId === job.id ? 'Working…' : 'Decline'}
                          </button>
                        </>
                      )}
                      {ds === 'upcoming' && (
                        <button
                          onClick={() => transitionJob(job.id, 'on-the-way')}
                          disabled={busyId === job.id}
                          className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                        >
                          {busyId === job.id ? 'Updating…' : 'On my way'}
                        </button>
                      )}
                      {ds === 'on-the-way' && (
                        <>
                          {showNotesFor === job.id ? (
                            <div data-card-interactive className="w-full flex flex-col gap-2">
                              <textarea
                                value={completionNotes[job.id] || ''}
                                onChange={(e) =>
                                  setCompletionNotes((prev) => ({
                                    ...prev,
                                    [job.id]: e.target.value,
                                  }))
                                }
                                placeholder="Add completion notes (optional)..."
                                className="w-full rounded-[10px] border border-line bg-page px-3 py-2 font-jost text-sm font-light text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                                rows={2}
                              />
                              <button
                                onClick={() => transitionJob(job.id, 'completed')}
                                disabled={busyId === job.id}
                                className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                              >
                                {busyId === job.id ? 'Completing…' : 'Confirm Complete'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowNotesFor(job.id)}
                              className="rounded-[10px] bg-primary px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                            >
                              Mark Complete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* H3: quiet exit — ACCEPTED state only, never competing with
                    the primary. */}
                {ds === 'upcoming' &&
                  (cancelFor === job.id ? (
                    <div
                      className="mt-3 rounded-[10px] border border-danger/25 bg-surface p-3"
                      data-testid="cant-make-it-confirm"
                      data-card-interactive
                    >
                      <p className="font-jost text-[13px] leading-relaxed text-ink-2">
                        Cancel this job? {job.clientName} will be told straight away and offered a
                        full refund or a free rebooking with another cleaner. This cancellation will
                        affect your completion rate — only cancel if you genuinely can&apos;t make
                        it.
                      </p>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder="Tell us why (optional — shared with Rena, not the customer)"
                        className="mt-2 w-full rounded-[8px] border border-line bg-page px-3 py-2 font-jost text-[13px] text-ink placeholder:text-ink-3/60 focus:outline-none focus:ring-1 focus:ring-danger/40"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleCleanerCancel(job.id)}
                          disabled={busyId === job.id}
                          className="rounded-[10px] bg-danger px-3 py-2 font-jost text-[13px] font-medium text-white disabled:opacity-50"
                        >
                          {busyId === job.id ? 'Cancelling…' : 'Cancel this job'}
                        </button>
                        <button
                          onClick={() => {
                            setCancelFor(null);
                            setCancelReason('');
                          }}
                          disabled={busyId === job.id}
                          className="rounded-[10px] border border-line px-3 py-2 font-jost text-[13px] font-medium text-ink-2"
                        >
                          I can make it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => setCancelFor(job.id)}
                        className="font-jost text-[12px] font-light text-ink-3 underline underline-offset-2 hover:text-ink-2"
                      >
                        Can&apos;t make this job?
                      </button>
                    </div>
                  ))}

                {/* Lifecycle status bar */}
                {(ds === 'upcoming' || ds === 'on-the-way' || ds === 'completed') && (
                  <div className="mt-4 border-t border-line pt-4">
                    <div className="flex items-center justify-between">
                      {LIFECYCLE_STEPS.map((step, i) => {
                        const currentIdx = getLifecycleStepIndex(job.status);
                        const isCompleted = i <= currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <div key={step.key} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                              <div
                                className={`w-8 h-8 flex items-center justify-center font-jost text-[10px] font-medium ${
                                  isCompleted
                                    ? isCurrent
                                      ? 'bg-primary text-white ring-4 ring-primary/15'
                                      : 'bg-primary text-white'
                                    : 'bg-primary-soft text-ink-3'
                                }`}
                              >
                                {isCompleted && !isCurrent ? (
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  i + 1
                                )}
                              </div>
                              <p
                                className={`mt-1 font-jost text-[10px] uppercase tracking-[0.1em] ${isCurrent ? 'font-medium text-primary' : isCompleted ? 'text-ink' : 'text-ink-3'}`}
                              >
                                {step.label}
                              </p>
                            </div>
                            {i < LIFECYCLE_STEPS.length - 1 && (
                              <div
                                className={`h-0.5 flex-1 mx-1 ${i < currentIdx ? 'bg-primary' : 'bg-line'}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
