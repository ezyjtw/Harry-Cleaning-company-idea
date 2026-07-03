'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import CleanerSetupChecklist from '@/components/cleaner/CleanerSetupChecklist';
import { useAuth } from '@/hooks/useAuth';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';

interface UpcomingJob {
  id: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  cleanerEarnings: number;
  status: string;
  bedrooms?: number;
}

interface RecentReview {
  id: string;
  clientName: string;
  rating: number;
  comment: string;
  date: string;
}

interface DashboardData {
  profile: {
    name: string;
    rating: number;
    tier: string;
    completedJobs: number;
    availableNow: boolean;
    verified: boolean;
    verificationStatus: string;
    insuranceVerified: boolean;
    profileComplete: boolean;
    acknowledgmentComplete: boolean;
    serviceTypes: string[];
    hourlyRateRegular: number | null;
    eotPrices: Record<string, unknown> | null;
    airbnbPrices: Record<string, unknown> | null;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    homePostcode: string | null;
    maxTravelMinutes: number | null;
    availabilitySlotsCount: number;
    importedReviewCount: number;
  };
  stats: {
    todaysJobs: number;
    weeklyEarnings: string;
    rating: string;
    reviewCount: number;
    responseRate: number;
    backupBookingCount: number;
  };
  dailyPercents: number[];
  upcomingJobs: UpcomingJob[];
  recentReviews: RecentReview[];
}

export default function CleanerDashboard() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, isCleaner } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Inline, non-fatal error for accept/decline actions — the top-level `error`
  // takes over the whole page, which must NOT happen for a failed job action.
  const [actionError, setActionError] = useState<string | null>(null);
  const [availableNow, setAvailableNow] = useState(false);
  const [jobs, setJobs] = useState<UpcomingJob[]>([]);

  // #1: no 401→/login here. A transient 401 while the session is still valid must
  // NOT log the user out. Genuine unauthentication is handled by the guard effect
  // below (via useAuth status); a 401 here just surfaces as a retryable load error.
  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/cleaner/dashboard');
    if (!res.ok) throw new Error('Failed to load dashboard');
    const d = await res.json();
    setData(d);
    setAvailableNow(d.profile.availableNow);
    setJobs(d.upcomingJobs);
  }, []);

  // #1: redirect ONLY on a definitive auth verdict — never while the session is
  // still loading. Prevents the spurious "log back in" bounce on navigation.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?callbackUrl=/cleaner');
    } else if (!isCleaner) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, isCleaner, router]);

  useEffect(() => {
    // Wait for a definitive, correct-role session before fetching; the guard
    // effect above handles the redirect for the other cases.
    if (authLoading || !isAuthenticated || !isCleaner) return;
    loadDashboard()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, isCleaner, loadDashboard]);

  const toggleAvailable = useCallback(async () => {
    const next = !availableNow;
    setAvailableNow(next);
    await fetch('/api/cleaner/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availableNow: next }),
    });
  }, [availableNow]);

  // Accept via the cascade/price-aware POST endpoint (same path the jobs page uses).
  // The legacy PATCH {status:'ACCEPTED'} route rejects PENDING→ACCEPTED (400), which
  // is why the dashboard could never accept.
  const handleAccept = useCallback(
    async (jobId: string) => {
      setActionError(null);
      const res = await fetch(`/api/cleaner/jobs/${jobId}/accept`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // PROVISIONAL (awaiting customer approval) / RESERVED (held) keep the job in
        // a pending-ish state with new flags — refetch so the dashboard reflects it.
        if (data?.outcome === 'PROVISIONAL' || data?.outcome === 'RESERVED') {
          await loadDashboard().catch(() => {});
          return;
        }
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'confirmed' } : j)));
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || 'Failed to accept job. Please try again.');
      }
    },
    [loadDashboard]
  );

  // Decline via the POST endpoint (runs cascade cleanup + re-offer), not the legacy PATCH.
  const handleDecline = useCallback(async (jobId: string) => {
    setActionError(null);
    const res = await fetch(`/api/cleaner/jobs/${jobId}/decline`, { method: 'POST' });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } else {
      const data = await res.json().catch(() => null);
      setActionError(data?.error || 'Failed to decline job. Please try again.');
    }
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-ink/5 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-ink/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div
          className="rounded-xl bg-red-50 p-8 text-center"
          style={{ border: '1px solid rgba(239,68,68,0.1)' }}
        >
          <p className="font-jost text-sm text-red-600">
            {error || 'Failed to load dashboard. Please try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full px-6 py-2.5 bg-ink text-cream font-jost text-[13px] font-light hover:bg-ink/90 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data.profile.verified) {
    const status = data.profile.verificationStatus;
    const isPending = status === 'PENDING';
    const isRejected = status === 'REJECTED';

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="text-center py-10">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: isPending ? 'rgba(234,179,8,0.08)' : 'rgba(27,42,74,0.04)' }}
          >
            {isPending ? (
              <svg
                className="h-10 w-10 text-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-10 w-10 text-ink-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>

          <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
            {isPending
              ? 'Your application is under review'
              : isRejected
                ? 'Application needs attention'
                : `Welcome, ${data.profile.name?.split(' ')[0] || 'Cleaner'}`}
          </h1>

          <p className="mt-3 max-w-md mx-auto font-jost text-[15px] font-light text-ink-2 leading-relaxed">
            {isPending
              ? "We're reviewing your documents and background check. This usually takes 24–48 hours. We'll notify you by email once approved."
              : isRejected
                ? 'There was an issue with your application. Please update your documents and resubmit.'
                : 'Complete the steps below to get verified and start receiving bookings.'}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {[
            {
              label: 'Complete your profile',
              description: 'Bio, postcode, specialties, and hourly rate',
              done: data.profile.profileComplete,
              href: '/cleaner/complete-profile',
            },
            {
              label: 'Upload identity documents',
              description: 'Photo ID and proof you can legally work in the UK',
              done: isPending || data.profile.verified,
              href: '/verify',
            },
            {
              label: 'Proof of insurance',
              description: 'Upload your public liability insurance',
              done: data.profile.insuranceVerified || isPending || data.profile.verified,
              href: '/cleaner/profile',
            },
            {
              label: 'Identity verification',
              description: 'Verify your ID with a photo and selfie.',
              done: isPending || data.profile.verified,
              href: '/verify',
            },
            {
              label: 'Verification review',
              description: isPending
                ? "Under review — we'll email you when approved"
                : data.profile.verified
                  ? 'Approved'
                  : 'Complete previous steps first',
              done: data.profile.verified,
              href: null,
            },
          ].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-cream px-5 py-4"
              style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-jost ${
                  step.done
                    ? 'bg-green-50 text-green-600'
                    : isPending && i === 3
                      ? 'bg-gold/10 text-gold'
                      : 'bg-ink/5 text-ink-3'
                }`}
              >
                {step.done ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isPending && i === 3 ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-jost text-[14px] ${step.done ? 'text-ink-3' : 'font-medium text-ink'}`}
                >
                  {step.label}
                </p>
                <p className="font-jost text-[12px] font-light text-ink-3">{step.description}</p>
              </div>
              {!step.done && step.href && (
                <Link
                  href={step.href}
                  className="shrink-0 rounded-full bg-ink px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-cream transition hover:bg-ink/90"
                >
                  Start
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Productive setup during the verification wait — same checklist as the
            verified dashboard, driven by real state. */}
        <div className="mt-8">
          <CleanerSetupChecklist profile={data.profile} />
        </div>

        <p className="mt-8 text-center font-jost text-xs font-light text-ink-3">
          Need help?{' '}
          <Link href="/contact" className="text-gold hover:text-gold/80 transition">
            Contact support
          </Link>
        </p>
      </div>
    );
  }

  const statIcons = [
    <svg key="jobs" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>,
    <svg key="earn" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"
      />
    </svg>,
    <svg key="rate" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>,
    <svg key="resp" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>,
  ];

  const stats = [
    { label: "Today's Jobs", value: String(data.stats.todaysJobs), sub: 'Scheduled for today' },
    { label: 'Weekly Earnings', value: `£${data.stats.weeklyEarnings}`, sub: 'This week' },
    { label: 'Rating', value: data.stats.rating, sub: `${data.stats.reviewCount} reviews` },
    { label: 'Response Rate', value: `${data.stats.responseRate}%`, sub: 'Last 30 days' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">
            Welcome back, {data.profile.name?.split(' ')[0] || 'Cleaner'}
          </h1>
          <p className="font-jost text-sm font-light text-ink-3 mt-1">
            Here&apos;s your overview for today
          </p>
        </div>
        {SAME_DAY_FEATURE_ENABLED && (
          <div
            className="flex items-center gap-3 rounded-full bg-white px-5 py-2.5 shadow-sm"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <span className="text-sm font-jost font-light text-ink-2">Available Now</span>
            <button
              onClick={toggleAvailable}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                availableNow ? 'bg-gold' : 'bg-ink-3/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  availableNow ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {availableNow && (
              <span className="flex items-center gap-1.5 text-xs text-gold font-jost">
                <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
        )}
      </div>

      {/* Consolidated setup checklist — replaces the former service-area, payouts,
          and EoT/Airbnb pricing banners. Auto-completes from real state. */}
      <CleanerSetupChecklist profile={data.profile} />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-5"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                {stat.label}
              </p>
              <div className="text-ink-3/40">{statIcons[i]}</div>
            </div>
            <p className="font-newsreader text-3xl font-medium text-ink">{stat.value}</p>
            <p className="font-jost text-xs font-light text-ink-3 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {data.stats.backupBookingCount > 0 && (
        <div
          className="mb-6 rounded-xl bg-amber-50/50 px-5 py-4 flex items-center gap-3"
          style={{ border: '1px solid rgba(217,119,6,0.12)' }}
        >
          <span className="font-newsreader text-2xl font-medium text-amber-700">
            {data.stats.backupBookingCount}
          </span>
          <p className="font-jost text-sm font-light text-ink-2">
            You&apos;re listed as a backup cleaner for{' '}
            {data.stats.backupBookingCount === 1
              ? '1 booking'
              : `${data.stats.backupBookingCount} bookings`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Jobs */}
        <div
          className="lg:col-span-2 rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}
          >
            <h2 className="font-newsreader text-lg font-semibold text-ink">Upcoming Jobs</h2>
            <Link
              href="/cleaner/jobs"
              className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-gold/80 transition-colors"
            >
              View All
            </Link>
          </div>
          {actionError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-jost text-[12px] text-red-700">
              {actionError}
            </div>
          )}
          <div>
            {jobs.length === 0 && (
              <div className="px-6 py-12 text-center">
                <svg
                  className="w-10 h-10 text-ink-3/20 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="font-jost text-sm font-light text-ink-3">No upcoming jobs</p>
                <p className="font-jost text-xs font-light text-ink-3/60 mt-1">
                  New bookings will appear here
                </p>
              </div>
            )}
            {jobs.map((job, i) => (
              <div
                key={job.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-cream/30 transition-colors"
                style={i > 0 ? { borderTop: '1px solid rgba(14,14,12,0.04)' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-jost text-sm font-normal text-ink">{job.clientName}</p>
                    <span
                      className={`rounded-full font-jost text-[10px] uppercase tracking-[0.1em] px-2.5 py-0.5 ${
                        job.status === 'confirmed' || job.status === 'accepted'
                          ? 'bg-gold/10 text-gold'
                          : 'bg-ink/5 text-ink-3'
                      }`}
                    >
                      {job.status === 'confirmed' || job.status === 'accepted'
                        ? 'Confirmed'
                        : 'Pending'}
                    </span>
                  </div>
                  <p className="font-jost text-sm font-light text-ink-3 mt-0.5">{job.address}</p>
                  <div className="flex items-center gap-3 mt-1 font-jost text-sm font-light text-ink-3">
                    <span>{job.date}</span>
                    <span className="w-1 h-1 rounded-full bg-ink-3/30" />
                    <span>{job.time}</span>
                    <span className="w-1 h-1 rounded-full bg-ink-3/30" />
                    <span className="text-gold">{job.serviceType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <p className="font-newsreader text-lg font-medium text-ink">
                    {'£'}
                    {job.cleanerEarnings.toFixed(2)}
                  </p>
                  {(job.serviceType === 'end-of-tenancy' || job.serviceType === 'airbnb') &&
                    job.bedrooms !== undefined && (
                      <div
                        className="mt-1 rounded-lg bg-gold/5 px-3 py-2 text-left"
                        style={{ border: '1px solid rgba(184,151,90,0.15)' }}
                      >
                        <p className="font-jost text-xs font-medium text-ink">
                          {job.serviceType === 'end-of-tenancy'
                            ? 'End of Tenancy'
                            : 'AirBnB Turnover'}{' '}
                          {'—'} {job.bedrooms === 0 ? 'Studio' : `${job.bedrooms} bed`}
                        </p>
                        <p className="font-jost text-[11px] font-light text-ink-2 mt-0.5">
                          Customer pays: {'£'}
                          {job.price.toFixed(2)}
                        </p>
                        <p className="font-jost text-[11px] font-medium text-gold mt-0.5">
                          You receive: {'£'}
                          {job.cleanerEarnings.toFixed(2)}
                        </p>
                      </div>
                    )}
                  {job.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(job.id)}
                        className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[11px] uppercase tracking-[0.08em] hover:bg-ink/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(job.id)}
                        className="rounded-full px-4 py-1.5 bg-white text-ink font-jost text-[11px] uppercase tracking-[0.08em] hover:bg-cream-2 transition-colors"
                        style={{ border: '1px solid rgba(14,14,12,0.1)' }}
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
          <div
            className="rounded-xl bg-white p-6"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <h2 className="font-newsreader text-lg font-semibold text-ink mb-4">Earnings This Week</h2>
            <div className="h-40 flex items-end gap-2">
              {data.dailyPercents.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md bg-gold/70 transition-all"
                    style={{ height: `${h}%`, minHeight: h > 0 ? '8px' : '0' }}
                  />
                  <span className="font-jost text-[10px] font-light text-ink-3">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-4 pt-4 text-center"
              style={{ borderTop: '1px solid rgba(14,14,12,0.06)' }}
            >
              <p className="font-newsreader text-2xl font-medium text-ink">
                {'£'}
                {data.stats.weeklyEarnings}
              </p>
              <p className="font-jost text-xs font-light text-ink-3">Total this week</p>
            </div>
          </div>

          {/* Recent Reviews */}
          <div
            className="rounded-xl bg-white overflow-hidden"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}
            >
              <h2 className="font-newsreader text-lg font-semibold text-ink">Recent Reviews</h2>
              <Link
                href="/cleaner/reviews"
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-gold/80 transition-colors"
              >
                View All
              </Link>
            </div>
            <div>
              {data.recentReviews.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <svg
                    className="w-8 h-8 text-ink-3/20 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <p className="font-jost text-sm font-light text-ink-3">No reviews yet</p>
                </div>
              )}
              {data.recentReviews.map((review, i) => (
                <div
                  key={review.id}
                  className="px-6 py-4"
                  style={i > 0 ? { borderTop: '1px solid rgba(14,14,12,0.04)' } : undefined}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-jost text-sm font-normal text-ink">{review.clientName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg
                          key={j}
                          className={`w-3.5 h-3.5 ${j < review.rating ? 'text-gold' : 'text-ink-3/15'}`}
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
                  <p className="font-jost text-[11px] font-light text-ink-3 mt-1">{review.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
