'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type JobStatus = 'pending' | 'upcoming' | 'en-route' | 'in-progress' | 'completed';

interface Job {
  id: string;
  clientName: string;
  address: string;
  fullAddress: string;
  date: string;
  time: string;
  serviceType: string;
  totalPrice: number;
  cleanerEarnings: number;
  platformFee: number;
  status: string;
  duration: number;
  notes?: string;
  cleanerNotes?: string;
  bedrooms?: number;
  extras?: string[];
}

const statusMap: Record<string, JobStatus> = {
  pending: 'pending',
  awaiting_cleaner: 'pending',
  confirmed: 'pending',
  accepted: 'upcoming',
  en_route: 'en-route',
  in_progress: 'in-progress',
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
    case 'en-route':
      return ['EN_ROUTE'];
    case 'in-progress':
      return ['IN_PROGRESS'];
    case 'completed':
      return ['COMPLETED', 'REVIEWED'];
  }
}

const tabs: { key: JobStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'en-route', label: 'En Route' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const LIFECYCLE_STEPS: { key: JobStatus; label: string }[] = [
  { key: 'upcoming', label: 'Accepted' },
  { key: 'en-route', label: 'En Route' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const emptyMessages: Record<JobStatus, { title: string; description: string }> = {
  pending: { title: 'No pending jobs', description: 'You have no jobs waiting for your response.' },
  upcoming: { title: 'No upcoming jobs', description: 'You have no confirmed upcoming jobs.' },
  'en-route': { title: 'No en-route jobs', description: 'You are not en route to any jobs.' },
  'in-progress': {
    title: 'No jobs in progress',
    description: 'You are not currently working on any jobs.',
  },
  completed: { title: 'No completed jobs', description: 'Your completed jobs will appear here.' },
};

// API status to transition target
const transitionMap: Record<JobStatus, string> = {
  pending: 'ACCEPTED',
  upcoming: 'EN_ROUTE',
  'en-route': 'IN_PROGRESS',
  'in-progress': 'COMPLETED',
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
    'en-route': 0,
    'in-progress': 0,
    completed: 0,
  });
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(
    async (tab: JobStatus) => {
      const statuses = toApiStatuses(tab).join(',');
      const res = await fetch(`/api/cleaner/jobs?status=${statuses}&limit=50`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setJobList(
        data.jobs.map((j: Job) => ({
          ...j,
          status: j.status,
        }))
      );
    },
    [router]
  );

  // Fetch counts for all tabs on mount
  useEffect(() => {
    async function fetchCounts() {
      const allStatuses =
        'PENDING,AWAITING_CLEANER,CONFIRMED,ACCEPTED,EN_ROUTE,IN_PROGRESS,COMPLETED,REVIEWED';
      const res = await fetch(`/api/cleaner/jobs?status=${allStatuses}&limit=200`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const c: Record<JobStatus, number> = {
        pending: 0,
        upcoming: 0,
        'en-route': 0,
        'in-progress': 0,
        completed: 0,
      };
      for (const j of data.jobs) {
        const ds = toDisplayStatus(j.status);
        c[ds]++;
      }
      setCounts(c);
    }
    fetchCounts();
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchJobs(activeTab).finally(() => setLoading(false));
  }, [activeTab, fetchJobs]);

  const transitionJob = useCallback(
    async (id: string, newDisplayStatus: JobStatus) => {
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
    },
    [activeTab, completionNotes]
  );

  const handleDecline = useCallback(
    async (id: string) => {
      setError(null);
      const res = await fetch(`/api/cleaner/jobs/${id}/decline`, {
        method: 'POST',
      });
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
      const res = await fetch(`/api/cleaner/jobs/${id}/accept`, {
        method: 'POST',
      });
      if (res.ok) {
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
    [activeTab]
  );

  const getStatusBadge = (status: string) => {
    const ds = toDisplayStatus(status);
    const styles: Record<JobStatus, string> = {
      pending: 'bg-ink/5 text-ink-3',
      upcoming: 'bg-gold/10 text-gold',
      'en-route': 'bg-ink/10 text-ink',
      'in-progress': 'bg-gold/20 text-gold',
      completed: 'bg-gold/10 text-gold',
    };
    const labels: Record<JobStatus, string> = {
      pending: 'Pending',
      upcoming: 'Accepted',
      'en-route': 'En Route',
      'in-progress': 'In Progress',
      completed: 'Completed',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${styles[ds]}`}
      >
        {labels[ds]}
      </span>
    );
  };

  const getLifecycleStepIndex = (status: string): number => {
    const ds = toDisplayStatus(status);
    return LIFECYCLE_STEPS.findIndex((s) => s.key === ds);
  };

  return (
    <div className="bg-cream min-h-screen p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">My Jobs</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Manage your cleaning bookings
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
        <nav className="flex gap-6 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setError(null);
                setActiveTab(tab.key);
              }}
              className={`whitespace-nowrap pb-3 px-1 font-jost text-[11px] uppercase tracking-[0.1em] border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-gold text-gold'
                  : 'border-transparent text-ink-3 hover:text-ink-2 hover:border-ink/20'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 font-jost text-[10px] ${
                    activeTab === tab.key ? 'bg-gold/10 text-gold' : 'bg-ink/5 text-ink-3'
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
        <div className="mb-4 p-3 bg-red-50 text-red-800 font-jost text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-600 hover:text-red-800 font-medium"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-ink/5 h-32" />
          ))}
        </div>
      )}

      {/* Job list */}
      {!loading && jobList.length === 0 && (
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
          <h3 className="mt-4 font-cormorant text-lg font-light text-ink">
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
              <div
                key={job.id}
                className="bg-cream-2 p-5"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-jost text-sm font-medium text-ink">{job.clientName}</p>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="font-jost text-sm font-light text-ink-2">
                      {ds === 'pending' ? job.address : job.fullAddress || job.address}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-jost text-sm font-light text-ink-3">
                      <span className="flex items-center gap-1">
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
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {job.date}
                      </span>
                      <span className="flex items-center gap-1">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {job.time} ({job.duration}h)
                      </span>
                      <span className="text-gold font-medium">{job.serviceType}</span>
                    </div>
                    {job.extras && job.extras.length > 0 && (
                      <p className="font-jost text-xs font-light text-ink-3 mt-1">
                        Add-ons: {job.extras.join(', ')}
                      </p>
                    )}
                    <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
                      Ref: {job.id.slice(0, 12)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="font-cormorant text-2xl font-light text-ink">
                        &pound;{job.cleanerEarnings.toFixed(2)}
                      </p>
                      <p className="font-jost text-[11px] text-ink-3">
                        of &pound;{job.totalPrice.toFixed(2)} total
                      </p>
                    </div>

                    {(job.serviceType === 'end-of-tenancy' || job.serviceType === 'airbnb') &&
                      job.bedrooms !== undefined && (
                        <div
                          className="bg-gold/5 px-4 py-3 text-left max-w-xs"
                          style={{ border: '0.5px solid rgba(184,151,90,0.2)' }}
                        >
                          <p className="font-jost text-sm font-medium text-ink">
                            {job.serviceType === 'end-of-tenancy'
                              ? 'End of Tenancy'
                              : 'AirBnB Turnover'}{' '}
                            — {job.bedrooms === 0 ? 'Studio' : `${job.bedrooms} bed`}
                          </p>
                          <div className="mt-2 space-y-0.5">
                            <p className="font-jost text-sm font-light text-ink-2">
                              Customer pays: &pound;{job.totalPrice.toFixed(2)}
                            </p>
                            <p className="font-jost text-sm font-light text-ink-2">
                              Platform fee: -&pound;{job.platformFee.toFixed(2)}
                            </p>
                            <p className="font-jost text-sm font-medium text-gold mt-1">
                              You receive: &pound;{job.cleanerEarnings.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      )}

                    <div className="flex gap-2 flex-wrap justify-end">
                      {ds === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAccept(job.id)}
                            className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecline(job.id)}
                            className="px-4 py-2 bg-cream text-ink font-jost text-sm font-light hover:bg-cream-2 transition-colors"
                            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {ds === 'upcoming' && (
                        <button
                          onClick={() => transitionJob(job.id, 'en-route')}
                          className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                        >
                          I&apos;m On My Way
                        </button>
                      )}
                      {ds === 'en-route' && (
                        <button
                          onClick={() => transitionJob(job.id, 'in-progress')}
                          className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                        >
                          Start Cleaning
                        </button>
                      )}
                      {ds === 'in-progress' && (
                        <>
                          {showNotesFor === job.id ? (
                            <div className="w-full flex flex-col gap-2">
                              <textarea
                                value={completionNotes[job.id] || ''}
                                onChange={(e) =>
                                  setCompletionNotes((prev) => ({
                                    ...prev,
                                    [job.id]: e.target.value,
                                  }))
                                }
                                placeholder="Add completion notes (optional)..."
                                className="w-full bg-cream px-3 py-2 font-jost text-sm font-light text-ink focus:outline-none focus:ring-1 focus:ring-gold"
                                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                                rows={2}
                              />
                              <button
                                onClick={() => transitionJob(job.id, 'completed')}
                                className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                              >
                                Confirm Complete
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowNotesFor(job.id)}
                              className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                            >
                              Mark Complete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lifecycle status bar */}
                {(ds === 'upcoming' ||
                  ds === 'en-route' ||
                  ds === 'in-progress' ||
                  ds === 'completed') && (
                  <div
                    className="mt-4 pt-4"
                    style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                  >
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
                                      ? 'bg-gold text-cream ring-4 ring-gold/10'
                                      : 'bg-ink text-cream'
                                    : 'bg-ink/5 text-ink-3'
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
                                className={`mt-1 font-jost text-[10px] uppercase tracking-[0.1em] ${isCurrent ? 'font-medium text-gold' : isCompleted ? 'text-ink' : 'text-ink-3'}`}
                              >
                                {step.label}
                              </p>
                            </div>
                            {i < LIFECYCLE_STEPS.length - 1 && (
                              <div
                                className={`h-0.5 flex-1 mx-1 ${i < currentIdx ? 'bg-ink' : 'bg-ink/5'}`}
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
