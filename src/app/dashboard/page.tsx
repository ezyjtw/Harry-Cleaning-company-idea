'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

interface Booking {
  id: string;
  date: string;
  scheduledDate: string;
  scheduledTime: string;
  serviceType: string;
  status: string;
  totalPrice: number;
  cleaner: { id: string; name: string; image: string | null } | null;
  address: { line1: string; city: string; postcode: string } | null;
}

interface Profile {
  name: string;
  email: string;
  phone: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return { label: 'Pending', cls: 'bg-amber-50 text-amber-700' };
    case 'CONFIRMED':
    case 'ACCEPTED':
      return { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700' };
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return { label: 'In Progress', cls: 'bg-indigo-50 text-indigo-700' };
    case 'COMPLETED':
    case 'REVIEWED':
      return { label: 'Completed', cls: 'bg-green-50 text-green-700' };
    case 'CANCELLED':
      return { label: 'Cancelled', cls: 'bg-ink/5 text-ink-3' };
    default:
      return { label: status, cls: 'bg-ink/5 text-ink-3' };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { isCleaner, isAdmin, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (isCleaner) {
      router.replace('/cleaner');
      return;
    }
    if (isAdmin) {
      router.replace('/admin');
      return;
    }
  }, [authLoading, isCleaner, isAdmin, router]);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, bookingsRes] = await Promise.all([
          fetch('/api/auth/profile'),
          fetch('/api/bookings'),
        ]);
        if (profileRes.ok) {
          const p = await profileRes.json();
          setProfile({ name: p.name || '', email: p.email || '', phone: p.phone || '' });
        }
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setBookings(data.bookings || data || []);
        }
      } catch {
        // API may not be available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const upcoming = bookings.filter((b) => {
    const s = b.status.toUpperCase();
    return (
      s === 'PENDING' ||
      s === 'CONFIRMED' ||
      s === 'ACCEPTED' ||
      s === 'EN_ROUTE' ||
      s === 'IN_PROGRESS'
    );
  });
  const past = bookings.filter((b) => {
    const s = b.status.toUpperCase();
    return s === 'COMPLETED' || s === 'REVIEWED';
  });

  const firstName = profile?.name?.split(' ')[0] || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-ink/5 rounded-lg w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-ink/5 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-cormorant text-3xl font-light text-ink">
            {firstName ? `Welcome back, ${firstName}` : 'Your Dashboard'}
          </h1>
          <p className="font-jost text-sm font-light text-ink-2 mt-1">
            Manage your bookings and account
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="/services"
            className="rounded-xl bg-ink p-5 text-cream hover:bg-ink/90 transition group"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="w-5 h-5 text-gold"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="font-jost text-sm font-light">Book a Cleaning</span>
            </div>
            <p className="font-jost text-xs font-light text-cream/60">
              Find trusted cleaners near you
            </p>
          </Link>

          <Link
            href="/account/bookings"
            className="rounded-xl bg-white p-5 hover:shadow-sm transition"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="w-5 h-5 text-ink-3"
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
              <span className="font-jost text-sm font-light text-ink">My Bookings</span>
            </div>
            <p className="font-jost text-xs font-light text-ink-3">
              {upcoming.length > 0 ? `${upcoming.length} upcoming` : 'View booking history'}
            </p>
          </Link>

          <Link
            href="/account"
            className="rounded-xl bg-white p-5 hover:shadow-sm transition"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="w-5 h-5 text-ink-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-jost text-sm font-light text-ink">My Account</span>
            </div>
            <p className="font-jost text-xs font-light text-ink-3">Profile, addresses & settings</p>
          </Link>
        </div>

        {/* Upcoming bookings */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-cormorant text-xl font-light text-ink">Upcoming Bookings</h2>
            {upcoming.length > 0 && (
              <Link
                href="/account/bookings"
                className="font-jost text-sm font-light text-gold hover:text-gold/80 transition"
              >
                View all
              </Link>
            )}
          </div>

          {upcoming.length === 0 ? (
            <div
              className="rounded-xl bg-white p-8 text-center"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <svg
                className="w-12 h-12 text-ink-3/15 mx-auto mb-3"
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
              <p className="font-jost text-sm font-light text-ink-3 mb-4">No upcoming bookings</p>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 font-jost text-sm font-light text-cream hover:bg-ink/90 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Book your first clean
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 3).map((booking) => {
                const status = formatStatus(booking.status);
                return (
                  <div
                    key={booking.id}
                    className="rounded-xl bg-white p-5"
                    style={{ border: '1px solid rgba(14,14,12,0.06)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-jost text-sm text-ink">
                            {booking.serviceType || 'Cleaning'}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-jost text-[11px] font-light ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="font-jost text-sm font-light text-ink-2">
                          {formatDate(booking.scheduledDate || booking.date)}
                          {booking.scheduledTime && ` at ${booking.scheduledTime}`}
                        </p>
                        {booking.address && (
                          <p className="font-jost text-xs font-light text-ink-3 mt-1">
                            {booking.address.line1}, {booking.address.postcode}
                          </p>
                        )}
                        {booking.cleaner?.name && (
                          <p className="font-jost text-xs font-light text-ink-3 mt-0.5">
                            Cleaner: {booking.cleaner.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="font-cormorant text-lg font-light text-ink">
                          &pound;{(booking.totalPrice || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past bookings */}
        {past.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cormorant text-xl font-light text-ink">Recent Bookings</h2>
              <Link
                href="/account/bookings"
                className="font-jost text-sm font-light text-gold hover:text-gold/80 transition"
              >
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {past.slice(0, 3).map((booking) => {
                const status = formatStatus(booking.status);
                return (
                  <div
                    key={booking.id}
                    className="rounded-xl bg-white p-5"
                    style={{ border: '1px solid rgba(14,14,12,0.06)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-jost text-sm text-ink">
                            {booking.serviceType || 'Cleaning'}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-jost text-[11px] font-light ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="font-jost text-sm font-light text-ink-2">
                          {formatDate(booking.scheduledDate || booking.date)}
                        </p>
                        {booking.cleaner?.name && (
                          <p className="font-jost text-xs font-light text-ink-3 mt-0.5">
                            Cleaner: {booking.cleaner.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="font-cormorant text-lg font-light text-ink">
                          &pound;{(booking.totalPrice || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Account summary */}
        {profile && (
          <div
            className="rounded-xl bg-white p-6"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cormorant text-xl font-light text-ink">Account Details</h2>
              <Link
                href="/account"
                className="font-jost text-sm font-light text-gold hover:text-gold/80 transition"
              >
                Edit
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="font-jost text-xs font-light text-ink-3 mb-0.5">Name</p>
                <p className="font-jost text-sm text-ink">{profile.name || '—'}</p>
              </div>
              <div>
                <p className="font-jost text-xs font-light text-ink-3 mb-0.5">Email</p>
                <p className="font-jost text-sm text-ink">{profile.email || '—'}</p>
              </div>
              <div>
                <p className="font-jost text-xs font-light text-ink-3 mb-0.5">Phone</p>
                <p className="font-jost text-sm text-ink">{profile.phone || '—'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
