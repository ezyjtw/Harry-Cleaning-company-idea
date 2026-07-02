'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// #5: customer job-detail view. Data + access control come entirely from the
// existing ownership-gated GET /api/bookings/[id] (clientId/cleaner/backup/admin
// only) — this page adds NO new route and no new access logic.

interface BookingDetail {
  id: string;
  serviceType: string;
  status: string;
  paymentStatus?: string | null;
  date: string;
  startTime: string;
  duration: number | string;
  totalPrice: number | string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressPostcode?: string | null;
  address?: { line1?: string; line2?: string; city?: string; postcode?: string } | null;
  notes?: string | null;
  cleaner: {
    id: string;
    name: string | null;
    image: string | null;
    cleanerProfile?: { rating: number | string | null } | null;
  } | null;
}

type LoadState = 'loading' | 'ok' | 'unauth' | 'forbidden' | 'notfound' | 'error';

function prettyStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BookingDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (res.status === 401) return setState('unauth');
        if (res.status === 403) return setState('forbidden');
        if (res.status === 404) return setState('notfound');
        if (!res.ok) return setState('error');
        setBooking(await res.json());
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-ink/5" />
          <div className="h-40 rounded-xl bg-ink/5" />
        </div>
      </div>
    );
  }

  if (state !== 'ok' || !booking) {
    const copy: Record<Exclude<LoadState, 'loading' | 'ok'>, { title: string; body: string }> = {
      unauth: { title: 'Please sign in', body: 'Sign in to view this booking.' },
      forbidden: { title: 'No access', body: "This booking isn't associated with your account." },
      notfound: { title: 'Not found', body: 'We couldn’t find that booking.' },
      error: { title: 'Something went wrong', body: 'Please try again in a moment.' },
    };
    const c = copy[state as Exclude<LoadState, 'loading' | 'ok'>] ?? copy.error;
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div
          className="rounded-xl bg-white p-8 text-center"
          style={{ border: '1px solid rgba(14,14,12,0.08)' }}
        >
          <h1 className="font-cormorant text-[22px] font-semibold text-ink">{c.title}</h1>
          <p className="mt-2 font-jost text-[14px] text-ink-3">{c.body}</p>
          <Link
            href={state === 'unauth' ? `/login?callbackUrl=/booking/${id}` : '/account/bookings'}
            className="mt-5 inline-block rounded-full bg-ink px-6 py-2.5 font-jost text-[12px] uppercase tracking-[0.1em] text-cream hover:bg-ink/90"
          >
            {state === 'unauth' ? 'Sign in' : 'My bookings'}
          </Link>
        </div>
      </div>
    );
  }

  const cleaner = booking.cleaner;
  const rating = cleaner?.cleanerProfile?.rating;
  const address = [
    booking.addressLine1 ?? booking.address?.line1,
    booking.addressLine2 ?? booking.address?.line2,
    booking.addressCity ?? booking.address?.city,
    booking.addressPostcode ?? booking.address?.postcode,
  ]
    .filter(Boolean)
    .join(', ');

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="font-jost text-[13px] text-ink-3">{label}</span>
      <span className="text-right font-jost text-[14px] font-medium text-ink">{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <Link
        href="/dashboard"
        className="font-jost text-[12px] uppercase tracking-[0.1em] text-gold hover:underline"
      >
        ← Back to dashboard
      </Link>

      <div
        className="mt-4 rounded-xl bg-white p-6"
        style={{ border: '1px solid rgba(14,14,12,0.08)' }}
      >
        {/* Cleaner */}
        <div className="flex items-center gap-3">
          {cleaner?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cleaner.image}
              alt={cleaner.name || 'Cleaner'}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/5 font-jost text-base font-medium text-ink-2">
              {(cleaner?.name || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-jost text-[15px] font-medium text-ink">
              {cleaner?.name || 'Assigned cleaner'}
            </p>
            {Number(rating) > 0 && (
              <p className="font-jost text-[12px] text-ink-3">★ {Number(rating).toFixed(1)}</p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-ink/5">
          <Row label="Service" value={prettyStatus(booking.serviceType)} />
          <Row label="Status" value={prettyStatus(booking.status)} />
          <Row label="Date" value={formatDate(booking.date)} />
          <Row label="Time" value={`${booking.startTime} · ${Number(booking.duration)}h`} />
          {address && <Row label="Address" value={address} />}
          <Row label="Total" value={`£${Number(booking.totalPrice).toFixed(2)}`} />
        </div>

        {booking.notes && (
          <div className="mt-4 rounded-lg bg-cream px-4 py-3">
            <p className="font-jost text-[12px] text-ink-3">Notes</p>
            <p className="mt-1 font-jost text-[14px] text-ink">{booking.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
