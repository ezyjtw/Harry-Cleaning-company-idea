'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

interface BookingAddress {
  id: string;
  line1?: string;
  line2?: string;
  city?: string;
  postcode?: string;
}

interface BookingUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface BookingReview {
  id: string;
  rating: number | string;
  text?: string | null;
}

interface Booking {
  id: string;
  serviceType: string;
  status: string;
  paymentStatus: string;
  date: string;
  startTime: string;
  duration: number | string;
  totalPrice: number | string;
  address: BookingAddress | null;
  cleaner: BookingUser;
  client: BookingUser | null;
  review: BookingReview | null;
  createdAt: string;
}

interface BookingsResponse {
  data: Booking[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const UPCOMING_STATUSES = new Set(['PENDING', 'CONFIRMED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS']);

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatServiceType(type: string): string {
  return type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: string): { text: string; className: string } {
  switch (status) {
    case 'PENDING':
      return { text: 'Pending', className: 'bg-gold/10 text-gold' };
    case 'CONFIRMED':
    case 'ACCEPTED':
      return { text: 'Confirmed', className: 'bg-green-50 text-green-600' };
    case 'EN_ROUTE':
      return { text: 'On the way', className: 'bg-blue-50 text-blue-600' };
    case 'IN_PROGRESS':
      return { text: 'In progress', className: 'bg-blue-50 text-blue-600' };
    default:
      return { text: status, className: 'bg-ink/5 text-ink-3' };
  }
}

interface RecentCleaner {
  id: string;
  name: string;
  image: string | null;
  lastDate: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, isCleaner, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentCleaners, setRecentCleaners] = useState<RecentCleaner[]>([]);
  const [unreviewedBookings, setUnreviewedBookings] = useState<Booking[]>([]);
  const [mostRecentCleaner, setMostRecentCleaner] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?callbackUrl=/dashboard');
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

    async function fetchDashboard() {
      try {
        const [allRes, completedRes] = await Promise.all([
          fetch('/api/bookings'),
          fetch('/api/bookings?status=COMPLETED'),
        ]);

        if (allRes.status === 401 || completedRes.status === 401) {
          router.push('/login');
          return;
        }
        if (!allRes.ok || !completedRes.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const allData: BookingsResponse = await allRes.json();
        const completedData: BookingsResponse = await completedRes.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = allData.data
          .filter((b) => UPCOMING_STATUSES.has(b.status) && new Date(b.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5);
        setUpcomingBookings(upcoming);

        const completed = completedData.data;

        const unreviewed = completed.filter((b) => b.status === 'COMPLETED' && !b.review);
        setUnreviewedBookings(unreviewed);

        const seenIds = new Set<string>();
        const cleaners: RecentCleaner[] = [];
        for (const b of completed) {
          if (!seenIds.has(b.cleaner.id)) {
            seenIds.add(b.cleaner.id);
            cleaners.push({
              id: b.cleaner.id,
              name: b.cleaner.name || 'Cleaner',
              image: b.cleaner.image,
              lastDate: b.date,
            });
            if (cleaners.length >= 3) break;
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

    fetchDashboard();
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || (!isAuthenticated && !error)) {
    return null;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-ink/5" />
          <div className="h-16 rounded-xl bg-ink/5" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-ink/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <div
          className="rounded-xl bg-red-50 p-8 text-center"
          style={{ border: '1px solid rgba(239,68,68,0.1)' }}
        >
          <p className="font-jost text-sm text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-ink px-6 py-2.5 font-jost text-[13px] font-light text-cream transition hover:bg-ink/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      {/* Section 1: Greeting + CTA */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-cormorant text-2xl font-light text-ink">Hello, {firstName}</h1>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">Welcome to your dashboard</p>
        </div>
        {mostRecentCleaner ? (
          <Link
            href={`/book/${mostRecentCleaner.id}`}
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 font-jost text-[13px] font-medium text-cream transition hover:bg-ink/90"
          >
            Book {mostRecentCleaner.name.split(' ')[0]} again
          </Link>
        ) : (
          <Link
            href="/cleaners"
            className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 font-jost text-[13px] font-medium text-cream transition hover:bg-ink/90"
          >
            Find a cleaner
          </Link>
        )}
      </div>

      {/* Section 2: Upcoming Bookings */}
      <section className="mb-8">
        <div
          className="overflow-hidden rounded-xl bg-white"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid rgba(14,14,12,0.06)' }}
          >
            <h2 className="font-cormorant text-lg font-light text-ink">Upcoming Bookings</h2>
            {upcomingBookings.length > 0 && (
              <Link
                href="/account/bookings"
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold transition-colors hover:text-gold/80"
              >
                View All
              </Link>
            )}
          </div>

          {upcomingBookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto mb-3 h-10 w-10 text-ink-3/20"
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
                className="mt-3 inline-block font-jost text-sm font-normal text-gold transition-colors hover:text-gold/80"
              >
                Browse cleaners
              </Link>
            </div>
          ) : (
            <div>
              {upcomingBookings.map((booking, i) => {
                const badge = statusBadge(booking.status);
                return (
                  <div
                    key={booking.id}
                    className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center"
                    style={i > 0 ? { borderTop: '1px solid rgba(14,14,12,0.04)' } : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-jost text-sm font-normal text-ink">
                          {formatServiceType(booking.serviceType)}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${badge.className}`}
                        >
                          {badge.text}
                        </span>
                        {booking.paymentStatus && booking.paymentStatus !== 'SUCCEEDED' && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] text-amber-700">
                            {booking.paymentStatus.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-jost text-sm font-light text-ink-3">
                        {booking.cleaner.name || 'Assigned cleaner'}
                      </p>
                      <div className="mt-1 flex items-center gap-3 font-jost text-sm font-light text-ink-3">
                        <span>{formatDate(booking.date)}</span>
                        <span className="h-1 w-1 rounded-full bg-ink-3/30" />
                        <span>{booking.startTime}</span>
                        {booking.address?.postcode && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-ink-3/30" />
                            <span>{booking.address.postcode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="font-cormorant text-lg font-light text-ink">
                      £{Number(booking.totalPrice).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Recent Cleaners — hidden if none */}
      {recentCleaners.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 font-cormorant text-lg font-light text-ink">Your Cleaners</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {recentCleaners.map((cleaner) => (
              <Link
                key={cleaner.id}
                href={`/book/${cleaner.id}`}
                className="group rounded-xl bg-white p-5 transition-colors hover:bg-cream/30"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/5 font-jost text-sm font-medium text-ink-2">
                    {cleaner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-jost text-sm font-normal text-ink">
                      {cleaner.name}
                    </p>
                    <p className="font-jost text-xs font-light text-ink-3">
                      Last clean: {formatDate(cleaner.lastDate)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 font-jost text-[11px] font-medium uppercase tracking-[0.1em] text-gold transition-colors group-hover:text-gold/80">
                  Book again
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Unreviewed completed bookings — hidden if none */}
      {unreviewedBookings.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 font-cormorant text-lg font-light text-ink">Leave a Review</h2>
          <div className="space-y-3">
            {unreviewedBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 rounded-xl bg-white px-5 py-4"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <svg
                    className="h-4 w-4 text-gold"
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
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-jost text-sm font-normal text-ink">
                    How was your clean with {booking.cleaner.name || 'your cleaner'}?
                  </p>
                  <p className="font-jost text-xs font-light text-ink-3">
                    {formatServiceType(booking.serviceType)} &middot; {formatDate(booking.date)}
                  </p>
                </div>
                <Link
                  href="/account/bookings"
                  className="shrink-0 rounded-full bg-ink px-4 py-2 font-jost text-[11px] uppercase tracking-[0.08em] text-cream transition hover:bg-ink/90"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Account Quick Links */}
      <section>
        <h2 className="mb-4 font-cormorant text-lg font-light text-ink">Quick Links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/account"
            className="group flex items-center gap-3 rounded-xl bg-white p-5 transition-colors hover:bg-cream/30"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-3 transition-colors group-hover:bg-ink/10">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="font-jost text-sm font-normal text-ink">Saved Addresses</p>
          </Link>

          <Link
            href="/messages"
            className="group flex items-center gap-3 rounded-xl bg-white p-5 transition-colors hover:bg-cream/30"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-3 transition-colors group-hover:bg-ink/10">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="font-jost text-sm font-normal text-ink">Messages</p>
          </Link>

          <Link
            href="/account/bookings"
            className="group flex items-center gap-3 rounded-xl bg-white p-5 transition-colors hover:bg-cream/30"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-3 transition-colors group-hover:bg-ink/10">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <p className="font-jost text-sm font-normal text-ink">Booking History</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
