'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

interface Booking {
  id: string;
  date: string;
  time: string;
  cleanerName: string;
  serviceType: string;
  price: number;
  status: BookingStatus;
  address: string;
  backupCleanerNames: string[];
  autoAssignBackup: boolean;
}

const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

const filterOptions: Array<{ label: string; value: BookingStatus | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

function mapStatus(apiStatus: string): BookingStatus {
  switch (apiStatus.toUpperCase()) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'Confirmed';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'Completed';
    case 'CANCELLED':
    case 'DISPUTED':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | 'All'>('All');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bookings')
      .then((res) => (res.ok ? res.json() : { bookings: [] }))
      .then((data) => {
        const items = (data.bookings || data || []).map((b: Record<string, unknown>) => ({
          id: (b.id as string)?.substring(0, 8).toUpperCase() || String(b.id),
          date: typeof b.date === 'string' ? b.date.split('T')[0] : String(b.date),
          time: b.startTime || b.time || '',
          cleanerName: b.cleanerName || 'Assigned cleaner',
          serviceType: b.serviceType || 'Cleaning',
          price: Number(b.totalPrice || b.price || 0),
          status: mapStatus(String(b.status || 'PENDING')),
          address: b.address || b.fullAddress || '',
          backupCleanerNames: (b.backupCleanerNames as string[]) || [],
          autoAssignBackup: (b.autoAssignBackup as boolean) || false,
        }));
        setBookings(items);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? bookings : bookings.filter((b) => b.status === filter);

  const isUpcoming = (booking: Booking) =>
    (booking.status === 'Pending' || booking.status === 'Confirmed') &&
    new Date(booking.date) >= new Date();

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' as const } : b))
      );
    } catch {
      // Silently handle
    }
    setCancellingId(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My Bookings</h2>
        <Link
          href="/services"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New Booking
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === opt.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            No bookings found{filter !== 'All' ? ` with status "${filter}"` : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div
              key={booking.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {booking.serviceType}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {formatDate(booking.date)} at {booking.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>{booking.cleanerName}</span>
                    </div>
                    {booking.address && (
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{booking.address}</span>
                      </div>
                    )}
                    {(booking.backupCleanerNames.length > 0 || booking.autoAssignBackup) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          {booking.backupCleanerNames.length > 0
                            ? `Backups: ${booking.backupCleanerNames.join(', ')}`
                            : ''}
                          {booking.backupCleanerNames.length > 0 && booking.autoAssignBackup
                            ? ' · '
                            : ''}
                          {booking.autoAssignBackup ? 'Auto-assign enabled' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <span className="text-lg font-bold text-gray-900">&pound;{booking.price}</span>
                  <span className="text-xs text-gray-400">{booking.id}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {isUpcoming(booking) && (
                  <>
                    {cancellingId === booking.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Cancel this booking?</span>
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Yes, Cancel
                        </button>
                        <button
                          onClick={() => setCancellingId(null)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCancellingId(booking.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </>
                )}

                {booking.status === 'Completed' && (
                  <button className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
                    Rebook
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
