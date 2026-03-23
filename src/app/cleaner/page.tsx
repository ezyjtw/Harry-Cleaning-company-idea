'use client';

import { useState } from 'react';

interface UpcomingJob {
  id: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  status: 'pending' | 'confirmed';
}

interface RecentReview {
  id: string;
  clientName: string;
  rating: number;
  comment: string;
  date: string;
}

const mockUpcomingJobs: UpcomingJob[] = [
  {
    id: '1',
    clientName: 'Emma Wilson',
    address: '14 Baker St, W1U 3BW',
    date: '2026-03-14',
    time: '09:00',
    serviceType: 'Regular Clean',
    price: 65,
    status: 'confirmed',
  },
  {
    id: '2',
    clientName: 'James Taylor',
    address: '8 Canary Wharf, E14 5AB',
    date: '2026-03-14',
    time: '14:00',
    serviceType: 'Deep Clean',
    price: 120,
    status: 'pending',
  },
  {
    id: '3',
    clientName: 'Olivia Brown',
    address: '22 Richmond Rd, TW9 2NA',
    date: '2026-03-15',
    time: '10:00',
    serviceType: 'End of Tenancy',
    price: 180,
    status: 'pending',
  },
];

const mockRecentReviews: RecentReview[] = [
  {
    id: '1',
    clientName: 'Alice M.',
    rating: 5,
    comment: 'Absolutely spotless! Sarah is incredibly thorough and professional.',
    date: '2026-03-12',
  },
  {
    id: '2',
    clientName: 'Tom R.',
    rating: 4,
    comment: 'Great job overall. Very punctual and friendly.',
    date: '2026-03-10',
  },
  {
    id: '3',
    clientName: 'Nina P.',
    rating: 5,
    comment: 'Best cleaner we have ever had. Highly recommend!',
    date: '2026-03-08',
  },
];

export default function CleanerDashboard() {
  const [availableNow, setAvailableNow] = useState(false);
  const [jobs, setJobs] = useState(mockUpcomingJobs);

  const handleAccept = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'confirmed' as const } : j))
    );
  };

  const handleDecline = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const stats = [
    { label: "Today's Jobs", value: '3', change: '+1 from yesterday' },
    { label: 'Weekly Earnings', value: '£485', change: '+12% vs last week' },
    { label: 'Rating', value: '4.9', change: 'Based on 127 reviews' },
    { label: 'Response Rate', value: '98%', change: 'Last 30 days' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-cormorant text-2xl font-light text-ink">Dashboard</h1>
          <p className="font-jost text-sm font-light text-ink-3 mt-1">
            Welcome back, Sarah. Here is your overview.
          </p>
        </div>
        {/* Available Now toggle */}
        <div
          className="flex items-center gap-3 bg-cream-2 px-4 py-3"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <span className="text-sm font-jost font-light text-ink-2">Available Now</span>
          <button
            onClick={() => setAvailableNow(!availableNow)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              availableNow ? 'bg-gold' : 'bg-ink-3/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-cream transition-transform ${
                availableNow ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {availableNow && (
            <span className="flex items-center gap-1 text-xs text-gold font-jost">
              <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-cream-2 p-5"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {stat.label}
            </p>
            <p className="font-cormorant text-3xl font-light text-ink mt-1">{stat.value}</p>
            <p className="font-jost text-xs font-light text-ink-3 mt-2">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Jobs */}
        <div
          className="lg:col-span-2 bg-cream-2 overflow-hidden"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <h2 className="font-cormorant text-lg font-light text-ink">Upcoming Jobs</h2>
            <a
              href="/cleaner/jobs"
              className="font-jost text-xs uppercase tracking-[0.1em] text-gold hover:text-gold/80 transition-colors"
            >
              View All
            </a>
          </div>
          <div>
            {jobs.map((job, i) => (
              <div
                key={job.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                style={i > 0 ? { borderTop: '0.5px solid rgba(14,14,12,0.06)' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-jost text-sm font-normal text-ink">{job.clientName}</p>
                    <span
                      className={`font-jost text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 ${
                        job.status === 'confirmed' ? 'bg-gold/10 text-gold' : 'bg-ink/5 text-ink-3'
                      }`}
                    >
                      {job.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                  <p className="font-jost text-sm font-light text-ink-3 mt-0.5">{job.address}</p>
                  <div className="flex items-center gap-3 mt-1 font-jost text-sm font-light text-ink-3">
                    <span>{job.date}</span>
                    <span>{job.time}</span>
                    <span className="text-gold">{job.serviceType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <p className="font-cormorant text-lg font-light text-ink">£{job.price}</p>
                  {job.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(job.id)}
                        className="px-3 py-1.5 bg-ink text-cream font-jost text-xs uppercase tracking-[0.1em] hover:bg-ink/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(job.id)}
                        className="px-3 py-1.5 bg-cream text-ink font-jost text-xs uppercase tracking-[0.1em] hover:bg-cream-2 transition-colors"
                        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Earnings Chart */}
          <div className="bg-cream-2 p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-cormorant text-lg font-light text-ink mb-4">Earnings This Week</h2>
            <div className="h-40 flex items-end gap-2">
              {[40, 65, 45, 80, 55, 70, 0].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gold/80 transition-all"
                    style={{ height: `${h}%`, minHeight: h > 0 ? '8px' : '0' }}
                  />
                  <span className="font-jost text-xs font-light text-ink-3">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-4 pt-4 text-center"
              style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-cormorant text-2xl font-light text-ink">£485</p>
              <p className="font-jost text-xs font-light text-ink-3">Total this week</p>
            </div>
          </div>

          {/* Recent Reviews */}
          <div
            className="bg-cream-2 overflow-hidden"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <h2 className="font-cormorant text-lg font-light text-ink">Recent Reviews</h2>
              <a
                href="/cleaner/reviews"
                className="font-jost text-xs uppercase tracking-[0.1em] text-gold hover:text-gold/80 transition-colors"
              >
                View All
              </a>
            </div>
            <div>
              {mockRecentReviews.map((review, i) => (
                <div
                  key={review.id}
                  className="px-6 py-4"
                  style={i > 0 ? { borderTop: '0.5px solid rgba(14,14,12,0.06)' } : undefined}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-jost text-sm font-normal text-ink">{review.clientName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg
                          key={j}
                          className={`w-3.5 h-3.5 ${j < review.rating ? 'text-gold' : 'text-ink-3/20'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="font-jost text-sm font-light text-ink-2 line-clamp-2">
                    {review.comment}
                  </p>
                  <p className="font-jost text-xs font-light text-ink-3 mt-1">{review.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
