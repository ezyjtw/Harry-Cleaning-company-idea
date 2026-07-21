'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookingStatusChip, { cascadeSentence } from '@/components/BookingStatusChip';
import CleanerAvatar from '@/components/CleanerAvatar';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import { useAuth } from '@/hooks/useAuth';
import { serviceLabelFromSlug } from '@/lib/constants/services';

interface BookingUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface Booking {
  id: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  date: string;
  startTime: string;
  totalPrice: number | string;
  addressPostcode?: string | null;
  address: { postcode?: string } | null;
  cleaner: BookingUser;
  review: { id: string } | null;
  cascadePhase: string | null;
  topupAmount: number | string | null;
  /** H11: set while CLEANER_CANCELLED awaits the customer's rescue choice. */
  rescueDeadline?: string | null;
}

interface BookingsResponse {
  data: Booking[];
}

interface RecentCleaner {
  id: string;
  name: string;
  image: string | null;
  lastDate: string;
}

// H18: CASCADE_EXHAUSTED removed — it's a TERMINAL no-cleaner state (refund
// firing), not an upcoming clean. Listing it here made a refunded booking look
// like it was still sourcing on the dashboard.
const UPCOMING_STATUSES = new Set([
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'EN_ROUTE',
  'IN_PROGRESS',
]);

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function AccountHome() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, isCleaner, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  // H11: CLEANER_CANCELLED bookings awaiting the customer's rescue choice —
  // announced FIRST on the account home, not buried in the list.
  const [rescueBookings, setRescueBookings] = useState<Booking[]>([]);
  // H57: price-change approvals waiting on the customer — same treatment
  // (email-only doors strand customers; the account home advertises them).
  const [approvalBookings, setApprovalBookings] = useState<Booking[]>([]);
  const [recentCleaners, setRecentCleaners] = useState<RecentCleaner[]>([]);
  const [unreviewedBookings, setUnreviewedBookings] = useState<Booking[]>([]);
  const [mostRecentCleaner, setMostRecentCleaner] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?callbackUrl=/account');
      return;
    }
    if (isCleaner) {
      router.push('/cleaner');
      return;
    }
    if (isAdmin) {
      router.push('/admin');
      return;
    }
  }, [authLoading, isAuthenticated, isCleaner, isAdmin, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    async function fetchHome() {
      try {
        const [allRes, completedRes, rescueRes, approvalRes] = await Promise.all([
          fetch('/api/bookings'),
          fetch('/api/bookings?status=COMPLETED,REVIEWED'),
          // H11: rescues are fetched EXPLICITLY — page 1 of the general list
          // (newest 10) can miss an older booking whose cleaner just cancelled.
          fetch('/api/bookings?status=CLEANER_CANCELLED'),
          // H57: pending price-change approvals, fetched explicitly for the
          // same reason.
          fetch('/api/bookings?approval=pending'),
        ]);
        // A transient 401 while still authenticated is a hiccup — surface it as a
        // retryable load error, not a spurious logout (the guard effect handles a
        // genuine session loss).
        if (!allRes.ok || !completedRes.ok) {
          throw new Error('Failed to load your dashboard');
        }

        const allData: BookingsResponse = await allRes.json();
        const completedData: BookingsResponse = await completedRes.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        setUpcomingBookings(
          allData.data
            .filter((b) => UPCOMING_STATUSES.has(b.status) && new Date(b.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5)
        );
        const rescueData: BookingsResponse | null = rescueRes.ok ? await rescueRes.json() : null;
        setRescueBookings(rescueData?.data ?? []);
        const approvalData: BookingsResponse | null = approvalRes.ok
          ? await approvalRes.json()
          : null;
        setApprovalBookings(approvalData?.data ?? []);

        const completed = completedData.data;
        setUnreviewedBookings(completed.filter((b) => b.status === 'COMPLETED' && !b.review));

        const seen = new Set<string>();
        const cleaners: RecentCleaner[] = [];
        for (const b of completed) {
          if (!seen.has(b.cleaner.id)) {
            seen.add(b.cleaner.id);
            cleaners.push({
              id: b.cleaner.id,
              name: b.cleaner.name || 'Cleaner',
              image: b.cleaner.image,
              lastDate: b.date,
            });
          }
        }
        setRecentCleaners(cleaners);
        if (completed.length > 0) {
          setMostRecentCleaner({
            id: completed[0].cleaner.id,
            name: completed[0].cleaner.name || 'your cleaner',
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    fetchHome();
  }, [authLoading, isAuthenticated]);

  if (authLoading || (!isAuthenticated && !error)) {
    return null;
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-line" />
        <div className="h-16 rounded-xl bg-line" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-line" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-8 text-center">
        <p className="font-jost text-sm text-danger">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-[10px] bg-primary px-6 py-2.5 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* H94: customer signup auto-logs-in straight to this page with no
          "check your email" interstitial — the verify banner (which carries
          the junk-folder whisper) IS that state, shown until verified. */}
      <VerifyEmailBanner />
      {/* Greeting + primary CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Hello, {firstName}</h1>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">
            Your bookings, cleaners and account — all in one place.
          </p>
        </div>
        {mostRecentCleaner ? (
          <Link
            href={`/book/${mostRecentCleaner.id}`}
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Book {mostRecentCleaner.name.split(' ')[0]} again
          </Link>
        ) : (
          <Link
            href="/cleaners"
            className="inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Find a cleaner
          </Link>
        )}
      </div>

      {/* H57: pending price-change approvals — same action-needed grammar as
          the rescue banner below; the two stack when both exist. */}
      {approvalBookings.map((b) => (
        <div
          key={`approval-${b.id}`}
          className="rounded-xl border border-warning/30 bg-warning/[0.06] p-5"
          data-testid="approval-banner"
        >
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">
            Action needed
          </p>
          <h2 className="mt-1 font-newsreader text-lg font-semibold text-ink">
            The price of your {serviceLabelFromSlug(b.serviceType)} on{' '}
            {new Date(b.date).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            has a proposed change of +£{Number(b.topupAmount ?? 0).toFixed(2)} — review it
          </h2>
          <p className="mt-1 font-jost text-sm text-ink-2">
            Nothing is charged unless you approve. If you decline or do nothing, your booking stands
            at its original price.
          </p>
          <Link
            href={`/booking/${b.id}/approve-topup`}
            className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Review the price change
          </Link>
        </div>
      ))}

      {/* H11: rescue announcements lead the page — a cancelled-by-cleaner
          booking awaiting the customer's choice must be the first thing seen. */}
      {rescueBookings.map((b) => (
        <div
          key={b.id}
          className="rounded-xl border border-danger/25 bg-danger/5 p-5"
          data-testid="rescue-banner"
        >
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
            Action needed
          </p>
          <h2 className="mt-1 font-newsreader text-lg font-semibold text-ink">
            Your cleaner had to cancel {serviceLabelFromSlug(b.serviceType)} on{' '}
            {new Date(b.date).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            — choose what happens next
          </h2>
          <p className="mt-1 font-jost text-sm text-ink-2">
            Keep the slot with another cleaner, pick a new date, or take a full refund.
            {b.rescueDeadline
              ? ` If you don't choose by ${new Date(b.rescueDeadline).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}, we'll refund you in full automatically.`
              : ' Your payment is safe either way.'}
          </p>
          <Link
            href={`/booking/${b.id}`}
            className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Choose what happens next
          </Link>
        </div>
      ))}

      {/* Upcoming bookings — teaser into the Bookings tab */}
      <section>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-newsreader text-lg font-semibold text-ink">Upcoming bookings</h2>
            {upcomingBookings.length > 0 && (
              <Link
                href="/account/bookings"
                className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:text-primary-hover"
              >
                View all
              </Link>
            )}
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto mb-3 h-10 w-10 text-ink-3/30"
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
              <p className="font-jost text-sm font-light text-ink-3">No upcoming bookings</p>
              <Link
                href="/cleaners"
                className="mt-3 inline-block font-jost text-sm text-primary transition-colors hover:text-primary-hover"
              >
                Browse cleaners
              </Link>
            </div>
          ) : (
            <div>
              {upcomingBookings.map((booking, i) => {
                const isProvisional =
                  booking.status === 'AWAITING_CLEANER' &&
                  booking.cascadePhase === 'PROVISIONAL_APPROVAL';
                const postcode = booking.addressPostcode || booking.address?.postcode;
                return (
                  <Link
                    key={booking.id}
                    href={
                      isProvisional ? `/booking/${booking.id}/approve-topup` : '/account/bookings'
                    }
                    className={`flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-page sm:flex-row sm:items-center ${
                      i > 0 ? 'border-t border-line' : ''
                    }`}
                  >
                    <CleanerAvatar
                      photo={booking.cleaner.image}
                      name={booking.cleaner.name || 'Cleaner'}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-jost text-sm text-ink">
                          {serviceLabelFromSlug(booking.serviceType)}
                        </p>
                        <BookingStatusChip
                          rawStatus={booking.status}
                          cascadePhase={booking.cascadePhase}
                        />
                      </div>
                      <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                        {booking.cleaner.name || 'Cleaner being assigned'}
                      </p>
                      {booking.status === 'AWAITING_CLEANER' &&
                        cascadeSentence(booking.cascadePhase, booking.cleaner.name) && (
                          <p className="mt-1 font-jost text-[13px] text-primary">
                            {cascadeSentence(booking.cascadePhase, booking.cleaner.name)}
                          </p>
                        )}
                      <div className="mt-1 flex items-center gap-3 font-jost text-sm font-light text-ink-3">
                        <span>{formatDate(booking.date)}</span>
                        <span className="h-1 w-1 rounded-full bg-ink-3/40" />
                        <span>{booking.startTime}</span>
                        {postcode && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-ink-3/40" />
                            <span>{postcode}</span>
                          </>
                        )}
                      </div>
                      {isProvisional && booking.topupAmount && (
                        <p className="mt-1 font-jost text-xs font-medium text-warning">
                          Extra £{Number(booking.topupAmount).toFixed(2)} needed — tap to review
                        </p>
                      )}
                    </div>
                    <p className="font-newsreader text-lg font-medium text-ink">
                      £{Number(booking.totalPrice).toFixed(2)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Your Cleaners — teaser into the My Cleaners tab */}
      {recentCleaners.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-newsreader text-lg font-semibold text-ink">Your cleaners</h2>
            <Link
              href="/account/cleaners"
              className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:text-primary-hover"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recentCleaners.slice(0, 2).map((cleaner) => (
              <Link
                key={cleaner.id}
                href="/account/cleaners"
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:bg-page"
              >
                <CleanerAvatar photo={cleaner.image} name={cleaner.name} size={44} />
                <div className="min-w-0">
                  <p className="truncate font-jost text-sm text-ink">{cleaner.name}</p>
                  <p className="font-jost text-xs font-light text-ink-3">
                    Last clean: {formatDate(cleaner.lastDate)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Review nudges — link into the Bookings tab where the review action lives */}
      {unreviewedBookings.length > 0 && (
        <section>
          <h2 className="mb-4 font-newsreader text-lg font-semibold text-ink">Leave a review</h2>
          <div className="space-y-3">
            {unreviewedBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-jost text-sm text-ink">
                    How was your clean with {booking.cleaner.name || 'your cleaner'}?
                  </p>
                  <p className="font-jost text-xs font-light text-ink-3">
                    {serviceLabelFromSlug(booking.serviceType)} &middot; {formatDate(booking.date)}
                  </p>
                </div>
                <Link
                  href="/account/bookings"
                  className="shrink-0 rounded-[10px] bg-primary px-4 py-2 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-primary-hover"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
