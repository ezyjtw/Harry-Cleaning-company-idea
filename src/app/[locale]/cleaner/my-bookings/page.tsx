'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import BookingStatusChip from '@/components/BookingStatusChip';
import CleanerAvatar from '@/components/CleanerAvatar';

// H38 (James-promoted from the ledger, minimal version): the missing shelf.
// A cleaner who books as a CUSTOMER sees those purchases here — customer
// grammar only (status, manage link), never job grammar, never Accept. The
// data is the same /api/bookings customer serialization every customer gets;
// managing happens on the same /booking/[id] page customers use.

interface ClientBooking {
  id: string;
  displayId?: string;
  serviceType: string;
  date: string;
  startTime: string;
  duration: number | string;
  totalPrice: number | string;
  status: string;
  cascadePhase?: string | null;
  cleaner?: { id: string; name: string | null; image: string | null } | null;
}

export default function CleanerMyBookingsPage() {
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bookings?as=client&pageSize=50')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setBookings(d.data || []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">My Bookings</h1>
        <p className="mt-1 font-jost text-sm font-light text-ink-2">
          Cleans you&apos;ve booked as a customer — separate from your jobs. Manage each one the
          same way any customer would.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-line" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <p className="font-jost text-sm font-light text-ink-3">
          You haven&apos;t booked any cleans as a customer.
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-4 rounded-xl bg-surface p-4 ring-1 ring-ink/[0.06]"
            >
              <CleanerAvatar
                photo={b.cleaner?.image}
                name={b.cleaner?.name || 'Cleaner'}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="font-jost text-sm font-medium text-ink">
                  {b.cleaner?.name || 'Your cleaner'} ·{' '}
                  {new Date(b.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {b.startTime ? `, ${b.startTime}` : ''}
                </p>
                <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
                  {String(b.serviceType).replace(/[-_]/g, ' ')} · £{Number(b.totalPrice).toFixed(2)}
                </p>
              </div>
              <BookingStatusChip rawStatus={b.status} cascadePhase={b.cascadePhase} />
              <Link
                href={`/booking/${b.id}`}
                className="rounded-[10px] border border-line px-4 py-2 font-jost text-xs font-medium text-ink-2 transition hover:bg-page"
              >
                Manage
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
