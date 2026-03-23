'use client';

import { useState } from 'react';

type JobStatus = 'pending' | 'upcoming' | 'en-route' | 'in-progress' | 'completed';

interface Job {
  id: string;
  clientName: string;
  address: string;
  fullAddress: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  status: JobStatus;
  duration: number;
  latitude: number;
  longitude: number;
  distance: number;
  notes?: string;
}

// Mock cleaner location (NW4 area)
const CLEANER_LAT = 51.5925;
const CLEANER_LNG = -0.2277;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const rawJobs = [
  {
    id: 'B-1001',
    clientName: 'Emma Wilson',
    address: '14 Baker St, W1U ***',
    fullAddress: '14 Baker St, London W1U 3BU',
    date: '2026-03-14',
    time: '09:00',
    serviceType: 'Regular Clean',
    price: 65,
    status: 'pending' as const,
    duration: 2,
    latitude: 51.5208,
    longitude: -0.1568,
    distance: 0,
  },
  {
    id: 'B-1002',
    clientName: 'James Taylor',
    address: '8 Canary Wharf, E14 ***',
    fullAddress: '8 Canary Wharf, London E14 5AB',
    date: '2026-03-14',
    time: '14:00',
    serviceType: 'Deep Clean',
    price: 120,
    status: 'pending' as const,
    duration: 4,
    latitude: 51.5054,
    longitude: -0.0235,
    distance: 0,
  },
  {
    id: 'B-1003',
    clientName: 'Olivia Brown',
    address: '22 Richmond Rd, TW9 ***',
    fullAddress: '22 Richmond Rd, London TW9 1DN',
    date: '2026-03-15',
    time: '10:00',
    serviceType: 'End of Tenancy',
    price: 180,
    status: 'upcoming' as const,
    duration: 5,
    latitude: 51.4613,
    longitude: -0.3037,
    distance: 0,
  },
  {
    id: 'B-1004',
    clientName: 'Liam Johnson',
    address: '5 Kensington High St, W8 ***',
    fullAddress: '5 Kensington High St, London W8 5NP',
    date: '2026-03-16',
    time: '08:30',
    serviceType: 'Regular Clean',
    price: 55,
    status: 'upcoming' as const,
    duration: 2,
    latitude: 51.4999,
    longitude: -0.1921,
    distance: 0,
  },
  {
    id: 'B-1005',
    clientName: 'Sophie Davis',
    address: '31 Camden Rd, NW1 ***',
    fullAddress: '31 Camden Rd, London NW1 9LG',
    date: '2026-03-13',
    time: '11:00',
    serviceType: 'AirBnB Turnover',
    price: 90,
    status: 'in-progress' as const,
    duration: 3,
    latitude: 51.5392,
    longitude: -0.1426,
    distance: 0,
  },
  {
    id: 'B-1006',
    clientName: 'Daniel Lee',
    address: '17 Brixton Hill, SW2 ***',
    fullAddress: '17 Brixton Hill, London SW2 1JF',
    date: '2026-03-12',
    time: '09:00',
    serviceType: 'Deep Clean',
    price: 140,
    status: 'completed' as const,
    duration: 4,
    latitude: 51.4513,
    longitude: -0.1145,
    distance: 0,
  },
  {
    id: 'B-1007',
    clientName: 'Mia Clark',
    address: '9 Greenwich Park, SE10 ***',
    fullAddress: '9 Greenwich Park, London SE10 8QY',
    date: '2026-03-11',
    time: '14:00',
    serviceType: 'Regular Clean',
    price: 60,
    status: 'completed' as const,
    duration: 2,
    latitude: 51.4769,
    longitude: -0.0005,
    distance: 0,
  },
  {
    id: 'B-1008',
    clientName: 'Noah White',
    address: '45 Fulham Rd, SW6 ***',
    fullAddress: '45 Fulham Rd, London SW6 1DU',
    date: '2026-03-10',
    time: '10:00',
    serviceType: 'End of Tenancy',
    price: 200,
    status: 'completed' as const,
    duration: 6,
    latitude: 51.4801,
    longitude: -0.1954,
    distance: 0,
  },
];
const mockJobs: Job[] = rawJobs.map((j) => ({
  ...j,
  distance: haversineDistance(CLEANER_LAT, CLEANER_LNG, j.latitude, j.longitude),
}));

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

export default function CleanerJobsPage() {
  const [activeTab, setActiveTab] = useState<JobStatus>('pending');
  const [jobList, setJobList] = useState(mockJobs);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);

  const filteredJobs = jobList.filter((j) => j.status === activeTab);

  const transitionJob = (id: string, newStatus: JobStatus) => {
    setJobList((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: newStatus,
              notes: newStatus === 'completed' ? completionNotes[id] || undefined : j.notes,
            }
          : j
      )
    );
    if (newStatus === 'completed') {
      setShowNotesFor(null);
    }
  };

  const handleDecline = (id: string) => {
    setJobList((prev) => prev.filter((j) => j.id !== id));
  };

  const getStatusBadge = (status: JobStatus) => {
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
        className={`inline-flex items-center px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const getDirectionsUrl = (job: Job) => {
    return `https://www.google.com/maps/dir/${CLEANER_LAT},${CLEANER_LNG}/${job.latitude},${job.longitude}`;
  };

  const getLifecycleStepIndex = (status: JobStatus): number => {
    return LIFECYCLE_STEPS.findIndex((s) => s.key === status);
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
          {tabs.map((tab) => {
            const count = jobList.filter((j) => j.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap pb-3 px-1 font-jost text-[11px] uppercase tracking-[0.1em] border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-gold text-gold'
                    : 'border-transparent text-ink-3 hover:text-ink-2 hover:border-ink/20'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 font-jost text-[10px] ${
                      activeTab === tab.key ? 'bg-gold/10 text-gold' : 'bg-ink/5 text-ink-3'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Job list */}
      {filteredJobs.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
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
                    {job.status === 'pending' ? job.address : job.fullAddress}
                  </p>

                  {/* Distance badge */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <svg
                      className="w-4 h-4 text-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="font-jost text-sm font-light text-gold">
                      {job.distance} miles away
                    </span>
                    {(job.status === 'pending' || job.status === 'upcoming') && (
                      <a
                        href={getDirectionsUrl(job)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-jost text-[11px] text-gold hover:text-gold/70 underline"
                      >
                        Get Directions
                      </a>
                    )}
                  </div>

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
                  <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
                    Ref: {job.id}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <p className="font-cormorant text-2xl font-light text-ink">&pound;{job.price}</p>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {job.status === 'pending' && (
                      <>
                        <button
                          onClick={() => transitionJob(job.id, 'upcoming')}
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
                    {job.status === 'upcoming' && (
                      <button
                        onClick={() => transitionJob(job.id, 'en-route')}
                        className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                      >
                        I&apos;m On My Way
                      </button>
                    )}
                    {job.status === 'en-route' && (
                      <button
                        onClick={() => transitionJob(job.id, 'in-progress')}
                        className="px-4 py-2 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors"
                      >
                        Start Cleaning
                      </button>
                    )}
                    {job.status === 'in-progress' && (
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

              {/* Lifecycle status bar for active jobs */}
              {(job.status === 'upcoming' ||
                job.status === 'en-route' ||
                job.status === 'in-progress' ||
                job.status === 'completed') && (
                <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}>
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
          ))}
        </div>
      )}
    </div>
  );
}
