'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';

import CleanerSetupChecklist from '@/components/cleaner/CleanerSetupChecklist';
import CleanerStatusChip from '@/components/cleaner/CleanerStatusChip';
import ProfilePhotoNudge from '@/components/ProfilePhotoNudge';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import { useAuth } from '@/hooks/useAuth';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import { serviceLabelFromSlug } from '@/lib/constants/services';

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
  isOffer: boolean;
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
  // H75: pre-complete jobs whose scheduled slot has ended — money-blocking
  // until the cleaner marks them complete (no auto-complete exists).
  overdueJobs?: { id: string; date: string; startTime: string; serviceType: string }[];
  profile: {
    name: string;
    rating: number;
    tier: string;
    completedJobs: number;
    availableNow: boolean;
    verified: boolean;
    verificationStatus: string;
    insuranceVerified: boolean;
    insuranceExpiresAt?: string | null;
    insuranceSubmitted?: boolean;
    rejectedDocuments?: { type: string; reason: string | null }[];
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
    noAvailabilityThisWeek: boolean;
    importedReviewCount: number;
  };
  stats: {
    todaysJobs: number;
    weeklyEarnings: string;
    rating: string;
    reviewCount: number;
    completionRate: number;
    backupBookingCount: number;
  };
  dailyPercents: number[];
  upcomingJobs: UpcomingJob[];
  recentReviews: RecentReview[];
}

export default function CleanerDashboard() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, isCleaner, isAdmin } = useAuth();
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
  // Landing-race hardening: the fetch is TIME-BOXED. Post-login is the app's
  // busiest instant (layout profile + this 8-query burst + notifications all at
  // once); under contention the proxy can hold this request for ~30s+ before
  // 503ing — without a timeout the skeleton sat on screen the whole time (the
  // reported "white screen": the error card existed but was never reached).
  const loadDashboard = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('/api/cleaner/dashboard', { signal: controller.signal });
      if (res.status === 404) {
        // H99 ①: a cleaner-role account with NO profile is a step-0 signup
        // that never finished the wizard — resume it, never a broken dashboard.
        router.push('/join');
        return;
      }
      if (!res.ok) throw new Error('Failed to load dashboard');
      const d = await res.json();
      setData(d);
      setAvailableNow(d.profile.availableNow);
      setJobs(d.upcomingJobs);
    } catch (e) {
      throw e instanceof DOMException && e.name === 'AbortError'
        ? new Error('The dashboard is taking too long to load.')
        : e;
    } finally {
      clearTimeout(timer);
    }
  }, [router]);

  // #1: redirect ONLY on a definitive auth verdict — never while the session is
  // still loading. Prevents the spurious "log back in" bounce on navigation.
  // Landing-race hardening: signIn({redirect:false}) resolves BEFORE the
  // SessionProvider context updates, so arrival straight from the login page
  // can briefly read as 'unauthenticated' with authLoading=false. Confirm with
  // a real session fetch before bouncing — a genuine sign-out still redirects,
  // a lost race self-corrects when the provider catches up.
  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      let cancelled = false;
      getSession().then((session) => {
        if (cancelled) return;
        if (!session) router.push('/login?callbackUrl=/cleaner');
        // Session exists → the provider is about to catch up; the effect
        // re-runs with isAuthenticated=true and the fetch effect takes over.
      });
      return () => {
        cancelled = true;
      };
    }
    if (!isCleaner) {
      // Role home directly — the /dashboard junction serves legacy links only.
      router.push(isAdmin ? '/admin' : '/account');
    }
    return undefined;
  }, [authLoading, isAuthenticated, isCleaner, isAdmin, router]);

  useEffect(() => {
    // Wait for a definitive, correct-role session before fetching; the guard
    // effect above handles the redirect for the other cases.
    if (authLoading || !isAuthenticated || !isCleaner) return;
    let cancelled = false;
    // Landing-race hardening: the first load after login is the burst moment —
    // one automatic retry after a short beat before surfacing the error card,
    // so transient first-load contention self-heals without a manual reload.
    loadDashboard()
      .catch(async () => {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        return loadDashboard().catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'confirmed', isOffer: false } : j))
        );
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
          className="rounded-xl bg-danger/10 p-8 text-center"
          style={{ border: '1px solid rgb(var(--color-danger) / 0.2)' }}
        >
          <p className="font-jost text-sm text-danger">
            {error || 'Failed to load dashboard. Please try again.'}
          </p>
          <button
            onClick={() => {
              // In-place retry — no full reload needed; the fetch is time-boxed
              // so a hung request comes back to this card, not a blank screen.
              setError(null);
              setLoading(true);
              loadDashboard()
                .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
                .finally(() => setLoading(false));
            }}
            className="mt-4 rounded-[10px] px-6 py-2.5 bg-primary text-white font-jost text-[13px] font-light hover:bg-primary-hover transition"
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
    // F8: a rejection outranks "under review" — the headline must be truthful.
    const rejectedDocs = data.profile.rejectedDocuments ?? [];
    const hasRejectedDocs = rejectedDocs.length > 0;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {/* H92: new cleaners live on this pending screen until approval —
            the verify nudge must reach them here, not just the dashboard. */}
        <VerifyEmailBanner />
        <div className="text-center py-10">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: isPending
                ? 'rgb(var(--color-warning) / 0.1)'
                : 'rgb(var(--color-primary-soft))',
            }}
          >
            {isPending ? (
              <svg
                className="h-10 w-10 text-primary"
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
            {hasRejectedDocs
              ? `Action needed — ${rejectedDocs.length} document${rejectedDocs.length === 1 ? '' : 's'} rejected`
              : isPending
                ? 'Your application is under review'
                : isRejected
                  ? 'Application needs attention'
                  : `Welcome, ${data.profile.name?.split(' ')[0] || 'Cleaner'}`}
          </h1>

          <p className="mt-3 max-w-md mx-auto font-jost text-[15px] font-light text-ink-2 leading-relaxed">
            {hasRejectedDocs
              ? "A document didn't pass review. The reason and the re-upload are right below — fix it and you're straight back in the queue."
              : isPending
                ? "We're verifying your identity — usually within one working day. You'll get an email the moment it's done."
                : isRejected
                  ? 'There was an issue with your application. Please update your documents and resubmit.'
                  : 'Complete the steps below to get verified and start receiving bookings.'}
          </p>
        </div>

        {/* F8: rejection → understanding why → re-uploading, one journey, no
            navigation. Each rejected doc is a card: the admin's reason on top,
            the re-upload control right under it (same mechanism as the inline
            insurance uploader). */}
        {hasRejectedDocs && (
          <div className="mt-6 space-y-3 text-left">
            {rejectedDocs.map((d) => (
              <RejectedDocCard key={d.type} type={d.type} reason={d.reason} />
            ))}
          </div>
        )}

        {/* Two-stage flow: the wait works for you — go-live prep runs in
            parallel with identity verification (James-ruled copy). */}
        {isPending && (
          <div className="mt-8">
            <h2 className="font-newsreader text-lg font-semibold text-ink">
              While we verify your identity, get ready to go live:
            </h2>
            <div className="mt-3 space-y-3">
              <GoLiveCard
                title="Set up payouts"
                description="Connect your bank securely via Stripe — about 5 minutes."
                state={
                  data.profile.stripeChargesEnabled && data.profile.stripePayoutsEnabled
                    ? 'done'
                    : 'todo'
                }
                doneLabel="Connected"
                todoLabel="Set up"
                href="/cleaner/stripe/connect"
              />
              <InlineInsuranceCard
                initialState={
                  data.profile.insuranceVerified
                    ? 'done'
                    : data.profile.insuranceSubmitted
                      ? 'waiting'
                      : 'todo'
                }
              />
            </div>
          </div>
        )}

        {/* H52 honesty rule: an item is TICKED only when its work is actually
            COMPLETE. Identity verification was ticking the moment documents were
            uploaded (isPending) — a lie: uploaded ≠ verified. The three honest
            states are: submitted → amber "under review"; verified → tick;
            rejected → action needed. "Upload identity documents" legitimately
            ticks on upload (uploading IS that item's completion); the separate
            "Verification review" row folded into this honest one. */}
        <div className="mt-8 space-y-3">
          {(() => {
            type StepState = 'done' | 'review' | 'action' | 'todo';
            const idVerifyState: StepState = data.profile.verified
              ? 'done'
              : hasRejectedDocs
                ? 'action'
                : isPending
                  ? 'review'
                  : 'todo';
            const steps: {
              label: string;
              description: string;
              state: StepState;
              href: string | null;
            }[] = [
              {
                label: 'Complete your profile',
                description: 'Bio, postcode, specialties, and hourly rate',
                state: data.profile.profileComplete ? 'done' : 'todo',
                href: '/cleaner/complete-profile',
              },
              {
                label: 'Upload identity documents',
                description: 'Photo ID and proof you can legally work in the UK',
                state: data.profile.verified
                  ? 'done'
                  : hasRejectedDocs
                    ? 'action'
                    : isPending
                      ? 'done'
                      : 'todo',
                href: '/verify',
              },
              {
                label: 'Identity verification',
                description:
                  idVerifyState === 'done'
                    ? 'Verified'
                    : idVerifyState === 'review'
                      ? "Submitted — under review. We'll email you when approved."
                      : idVerifyState === 'action'
                        ? 'A document needs re-uploading (see above).'
                        : 'Verify your ID with a photo and selfie.',
                state: idVerifyState,
                href: '/verify',
              },
            ];
            return steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl bg-page px-5 py-4"
                style={{ border: '0.5px solid rgb(var(--color-border))' }}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-jost ${
                    step.state === 'done'
                      ? 'bg-trust/10 text-trust'
                      : step.state === 'review'
                        ? 'bg-warning/10 text-warning'
                        : step.state === 'action'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-ink/5 text-ink-3'
                  }`}
                >
                  {step.state === 'done' ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.state === 'review' ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                    </svg>
                  ) : step.state === 'action' ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-jost text-[14px] ${step.state === 'done' ? 'text-ink-3' : 'font-medium text-ink'}`}
                  >
                    {step.label}
                  </p>
                  <p className="font-jost text-[12px] font-light text-ink-3">{step.description}</p>
                </div>
                {step.state !== 'done' && step.state !== 'review' && step.href && (
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-[10px] bg-primary px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-primary-hover"
                  >
                    {step.state === 'action' ? 'Fix' : 'Start'}
                  </Link>
                )}
              </div>
            ));
          })()}
        </div>

        {/* Productive setup during the verification wait — same checklist as the
            verified dashboard, driven by real state. */}
        <div className="mt-8">
          <CleanerSetupChecklist profile={data.profile} />
        </div>

        <p className="mt-8 text-center font-jost text-xs font-light text-ink-3">
          Need help?{' '}
          <Link href="/contact" className="text-primary hover:text-primary/80 transition">
            Contact support
          </Link>
        </p>
      </div>
    );
  }

  // Two-stage flow: verified but not yet LIVE (insurance approval and/or
  // Stripe payouts outstanding) — celebrate stage 1 and show what's left.
  const goLiveReady =
    data.profile.insuranceVerified &&
    data.profile.stripeChargesEnabled &&
    data.profile.stripePayoutsEnabled;
  if (!goLiveReady) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="text-center py-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-trust/10">
            <svg
              className="h-10 w-10 text-trust"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
            Your identity is verified!
          </h1>
          <p className="mt-3 max-w-md mx-auto font-jost text-[15px] font-light text-ink-2 leading-relaxed">
            Nearly there, {data.profile.name?.split(' ')[0] || 'cleaner'} — finish these and your
            profile goes live to customers automatically.
          </p>
        </div>
        <div className="space-y-3">
          <GoLiveCard
            title="Set up payouts"
            description="Connect your bank securely via Stripe — about 5 minutes."
            state={
              data.profile.stripeChargesEnabled && data.profile.stripePayoutsEnabled
                ? 'done'
                : 'todo'
            }
            doneLabel="Connected"
            todoLabel="Set up"
            href="/cleaner/stripe/connect"
          />
          <InlineInsuranceCard
            initialState={
              data.profile.insuranceVerified
                ? 'done'
                : data.profile.insuranceSubmitted
                  ? 'waiting'
                  : 'todo'
            }
          />
        </div>
        <p className="mt-8 text-center font-jost text-xs font-light text-ink-3">
          Need help?{' '}
          <Link href="/contact" className="text-primary hover:text-primary/80 transition">
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
    // B7 honesty: this figure is the non-cancelled share of recent bookings.
    { label: 'Completion Rate', value: `${data.stats.completionRate}%`, sub: 'Last 30 days' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* H92: soft verify-your-email nudge — shows only while unverified. */}
      <VerifyEmailBanner />
      {/* H98: friendly photo nudge for photo-less live cleaners — never a block. */}
      <ProfilePhotoNudge />
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
            className="flex items-center gap-3 rounded-full bg-surface px-5 py-2.5 shadow-sm"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <span className="text-sm font-jost font-light text-ink-2">Available Now</span>
            <button
              onClick={toggleAvailable}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                availableNow ? 'bg-primary' : 'bg-ink-3/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform ${
                  availableNow ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {availableNow && (
              <span className="flex items-center gap-1.5 text-xs text-primary font-jost">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
        )}
      </div>

      {/* Consolidated setup checklist — replaces the former service-area, payouts,
          and EoT/Airbnb pricing banners. Auto-completes from real state. */}
      <CleanerSetupChecklist profile={data.profile} />

      {/* H75 (Harry-ruled, money-safety): a job past its scheduled end that was
          never marked complete blocks the payout — completion is the ONLY
          trigger (no auto-complete exists). One banner per overdue job. */}
      {(data.overdueJobs ?? []).map((job) => (
        <div
          key={job.id}
          data-testid="overdue-completion-banner"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
        >
          <p className="font-jost text-sm text-amber-900">
            You haven&apos;t marked your {serviceLabelFromSlug(job.serviceType)} on{' '}
            {new Date(job.date).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}{' '}
            as complete — mark it done to get paid.
          </p>
          <Link
            href="/cleaner/jobs"
            className="shrink-0 rounded-[10px] bg-amber-600 px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-amber-700"
          >
            Mark it complete
          </Link>
        </div>
      ))}

      {/* H34 (James-ruled): quiet amber nudge when the CURRENT week has zero
          availability set — same timesheet truth as search (see dashboard API). */}
      {data.profile.noAvailabilityThisWeek && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-jost text-sm text-amber-900">
            You&apos;ve no availability set this week — customers can&apos;t book you until you do.
          </p>
          <Link
            href="/cleaner/availability"
            className="shrink-0 rounded-[10px] bg-amber-600 px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-amber-700"
          >
            Set availability
          </Link>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-xl bg-surface p-5"
            style={{ border: '1px solid rgb(var(--color-border))' }}
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

      {/* Insurance on the dashboard (James-ruled): live cleaners manage their
          policy here — status + expiry + inline upload/renewal — not in a buried
          profile subsection. Rejections and expiring-soon surface prominently. */}
      <DashboardInsurance profile={data.profile} />

      {data.stats.backupBookingCount > 0 && (
        <div
          className="mb-6 rounded-xl bg-warning/5 px-5 py-4 flex items-center gap-3"
          style={{ border: '1px solid rgb(var(--color-warning) / 0.2)' }}
        >
          <span className="font-newsreader text-2xl font-medium text-warning">
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
          className="lg:col-span-2 rounded-xl bg-surface overflow-hidden"
          style={{ border: '1px solid rgb(var(--color-border))' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
          >
            <h2 className="font-newsreader text-lg font-semibold text-ink">Upcoming Jobs</h2>
            <Link
              href="/cleaner/jobs"
              className="font-jost text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
            >
              View All
            </Link>
          </div>
          {actionError && (
            <div className="mx-6 mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-2 font-jost text-[12px] text-danger">
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
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-page/30 transition-colors"
                style={i > 0 ? { borderTop: '1px solid rgb(var(--color-border))' } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-jost text-sm font-normal text-ink">{job.clientName}</p>
                    <CleanerStatusChip status={job.status} />
                  </div>
                  <p className="font-jost text-sm font-light text-ink-3 mt-0.5">{job.address}</p>
                  <div className="flex items-center gap-3 mt-1 font-jost text-sm font-light text-ink-3">
                    <span>{job.date}</span>
                    <span className="w-1 h-1 rounded-full bg-ink-3/30" />
                    <span>{job.time}</span>
                    <span className="w-1 h-1 rounded-full bg-ink-3/30" />
                    <span className="text-primary">{serviceLabelFromSlug(job.serviceType)}</span>
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
                        className="mt-1 rounded-lg bg-primary/5 px-3 py-2 text-left"
                        style={{ border: '1px solid rgb(var(--color-border))' }}
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
                        <p className="font-jost text-[11px] font-medium text-primary mt-0.5">
                          You receive: {'£'}
                          {job.cleanerEarnings.toFixed(2)}
                        </p>
                      </div>
                    )}
                  {job.isOffer && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(job.id)}
                        className="rounded-[10px] px-4 py-1.5 bg-primary text-white font-jost text-[11px] uppercase tracking-[0.08em] hover:bg-primary-hover transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(job.id)}
                        className="rounded-[10px] px-4 py-1.5 bg-surface text-ink font-jost text-[11px] uppercase tracking-[0.08em] hover:bg-primary-soft transition-colors"
                        style={{ border: '1px solid rgb(var(--color-border))' }}
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
            className="rounded-xl bg-surface p-6"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <h2 className="font-newsreader text-lg font-semibold text-ink mb-4">
              Earnings This Week
            </h2>
            <div className="h-40 flex items-end gap-2">
              {data.dailyPercents.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md bg-primary/70 transition-all"
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
              style={{ borderTop: '1px solid rgb(var(--color-border))' }}
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
            className="rounded-xl bg-surface overflow-hidden"
            style={{ border: '1px solid rgb(var(--color-border))' }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgb(var(--color-border))' }}
            >
              <h2 className="font-newsreader text-lg font-semibold text-ink">Recent Reviews</h2>
              <Link
                href="/cleaner/reviews"
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
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
                  style={i > 0 ? { borderTop: '1px solid rgb(var(--color-border))' } : undefined}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-jost text-sm font-normal text-ink">{review.clientName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg
                          key={j}
                          className={`w-3.5 h-3.5 ${j < review.rating ? 'text-primary' : 'text-ink-3/15'}`}
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

// Two-stage go-live action card (waiting screen + verified-not-live screen).
function GoLiveCard({
  title,
  description,
  state,
  doneLabel,
  waitingLabel,
  todoLabel,
  href,
}: {
  title: string;
  description: string;
  state: 'done' | 'waiting' | 'todo';
  doneLabel: string;
  waitingLabel?: string;
  todoLabel: string;
  href: string;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl bg-page px-5 py-4"
      style={{ border: '0.5px solid rgb(var(--color-border))' }}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          state === 'done'
            ? 'bg-trust/10 text-trust'
            : state === 'waiting'
              ? 'bg-primary/10 text-primary'
              : 'bg-ink/5 text-ink-3'
        }`}
      >
        {state === 'done' ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : state === 'waiting' ? (
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
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-jost text-[14px] ${state === 'done' ? 'text-ink-3' : 'font-medium text-ink'}`}
        >
          {title}
        </p>
        <p className="font-jost text-[12px] font-light text-ink-3">
          {state === 'waiting' && waitingLabel ? waitingLabel : description}
        </p>
      </div>
      {state === 'done' ? (
        <span className="shrink-0 rounded-full bg-trust/10 px-3 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-trust">
          {doneLabel}
        </span>
      ) : state === 'waiting' ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
          {waitingLabel || 'Pending'}
        </span>
      ) : (
        <Link
          href={href}
          className="shrink-0 rounded-[10px] bg-primary px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-primary-hover"
        >
          {todoLabel}
        </Link>
      )}
    </div>
  );
}

// F8: inline re-upload AT the rejected document — the admin's reason above the
// control, the file pick right here, one journey without leaving the status
// screen. Identity docs post to the session-authed /api/cleaners/documents;
// insurance posts to /api/cleaner/insurance (needs the policy expiry too).
// On success the card flips to "Back under review" in place — and admin-side
// the newest-doc supersession flips their chip back to amber.
function RejectedDocCard({ type, reason }: { type: string; reason: string | null }) {
  const [state, setState] = useState<'todo' | 'busy' | 'done'>('todo');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isInsurance = type === 'insurance';
  const label =
    type === 'photo_id'
      ? 'Photo ID'
      : type === 'right_to_work'
        ? 'Right to Work'
        : type === 'dbs_certificate'
          ? 'DBS Certificate'
          : type === 'insurance'
            ? 'Insurance'
            : type === 'selfie'
              ? 'Verification selfie'
              : type;

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setFileData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError(null);
    if (!fileData) return setError('Choose the replacement file first.');
    if (isInsurance && !expiry) return setError('Enter the policy expiry date.');
    setState('busy');
    try {
      const res = isInsurance
        ? await fetch('/api/cleaner/insurance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData, fileName, expiryDate: expiry }),
          })
        : await fetch('/api/cleaners/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentType: type, fileData }),
          });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setState('done');
      } else {
        setState('todo');
        setError(body?.error || 'Upload failed. Please try again.');
      }
    } catch {
      setState('todo');
      setError('Network error — please try again.');
    }
  };

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="font-jost text-sm font-medium text-ink">
          {label}: <span className="text-trust">✓ re-uploaded — back under review</span>
        </p>
        <p className="mt-1 font-jost text-[12px] text-ink-3">
          We&apos;ll check the new copy — usually within one working day.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
      <p className="font-jost text-sm font-semibold text-danger">{label} — rejected</p>
      <p className="mt-1 font-jost text-[13px] text-ink-2">
        Rejected: {reason || 'please re-upload a clearer copy'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-light text-white transition hover:bg-primary-hover">
          {fileName ? 'Change file' : 'Choose replacement'}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
        {fileName && (
          <span className="max-w-[180px] truncate font-jost text-[12px] text-ink-2">
            {fileName}
          </span>
        )}
        {isInsurance && (
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            aria-label="Policy expiry date"
            className="rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink"
          />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={state === 'busy' || !fileData}
          className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[13px] font-medium text-ink transition hover:bg-page disabled:opacity-50"
        >
          {state === 'busy' ? 'Uploading…' : 'Re-upload'}
        </button>
      </div>
      {error && <p className="mt-2 font-jost text-[12px] text-danger">{error}</p>}
    </div>
  );
}

// Addendum (James): inline insurance upload on the status screen — the go-live
// journey never sends the cleaner hunting through profile subsections. Tap the
// card → file pick + expiry right here → the existing validated + secured
// /api/cleaner/insurance route → the card flips to "Awaiting approval" in place.
// (The buried profile-section upload stays for later renewals.)
function InlineInsuranceCard({ initialState }: { initialState: 'done' | 'waiting' | 'todo' }) {
  const [state, setState] = useState<'done' | 'waiting' | 'todo'>(initialState);
  const [open, setOpen] = useState(false);
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setFileData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError(null);
    if (!fileData || !fileName) return setError('Choose your insurance certificate.');
    if (!expiry) return setError('Enter the policy expiry date.');
    setBusy(true);
    try {
      const res = await fetch('/api/cleaner/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, fileName, expiryDate: expiry }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setState('waiting');
        setOpen(false);
      } else {
        setError(body?.error || 'Upload failed. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Approved / awaiting states reuse the shared card presentation.
  if (state !== 'todo') {
    return (
      <GoLiveCard
        title="Upload your insurance"
        description="Public liability insurance — we review it quickly once it's in."
        state={state}
        doneLabel="Approved"
        waitingLabel="Awaiting approval"
        todoLabel="Upload"
        href="/cleaner/profile"
      />
    );
  }

  return (
    <div
      className="rounded-xl bg-page px-5 py-4"
      style={{ border: '0.5px solid rgb(var(--color-border))' }}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-3">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-jost text-[14px] font-medium text-ink">Upload your insurance</p>
          <p className="font-jost text-[12px] font-light text-ink-3">
            Public liability insurance — we review it quickly once it&apos;s in.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-[10px] bg-primary px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-primary-hover"
          >
            Upload
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-[10px] border border-line bg-surface px-4 py-2.5 text-left font-jost text-sm text-ink-2 hover:bg-page"
          >
            {fileName || 'Choose certificate (PDF, JPG, PNG)'}
          </button>
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Policy expiry date
            </label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 w-full rounded-[10px] border border-line bg-surface px-4 py-2.5 font-jost text-sm text-ink"
            />
          </div>
          {error && <p className="font-jost text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-[10px] bg-primary px-4 py-2.5 font-jost text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Submit for review'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[10px] border border-line px-4 py-2.5 font-jost text-sm text-ink-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// James-ruled: insurance status + inline upload/renewal on the live dashboard.
function DashboardInsurance({ profile }: { profile: DashboardData['profile'] }) {
  const expiry = profile.insuranceExpiresAt ? new Date(profile.insuranceExpiresAt) : null;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
  const expired = daysLeft !== null && daysLeft <= 0;
  const rejected = profile.rejectedDocuments?.some((d) => d.type === 'insurance');

  // Approved + comfortably in-date → a quiet status line (no upload surface).
  if (profile.insuranceVerified && !expiringSoon && !expired && !rejected) {
    return (
      <div
        className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-surface px-5 py-3.5"
        style={{ border: '1px solid rgb(var(--color-border))' }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-trust/10 px-2.5 py-0.5 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-trust">
            Insurance approved
          </span>
          {expiry && (
            <span className="font-jost text-[12px] font-light text-ink-3">
              Expires{' '}
              {expiry.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Otherwise (missing / expiring / expired / rejected) → the inline uploader
  // with a status headline, right on the dashboard.
  const headline = rejected
    ? 'Your insurance was rejected — please re-upload'
    : expired
      ? 'Your insurance has expired — upload a current policy'
      : expiringSoon
        ? `Your insurance expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — renew it`
        : 'Add your public liability insurance';
  const tone = rejected || expired ? 'text-danger' : expiringSoon ? 'text-warning' : 'text-ink';
  return (
    <div className="mb-6">
      <p className={`mb-2 font-jost text-sm font-semibold ${tone}`}>{headline}</p>
      <InlineInsuranceCard
        initialState={profile.insuranceVerified && !expired && !rejected ? 'done' : 'todo'}
      />
    </div>
  );
}
