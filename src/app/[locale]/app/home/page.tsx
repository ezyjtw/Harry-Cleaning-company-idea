'use client';

// RENA customer app — Home (Phase 2, James-ruled; the approved mockup is the
// spec). The customer L2 front door: greeting header (bell + person) →
// YOUR NEXT CLEAN hero → review card (only while an unreviewed completed
// clean exists) → Book A Clean row → done. Skeleton never reorders; empty
// states swap the hero for the shared No Cleans card and drop the Book row.
// No dashes, no zeros, ever.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  CustomerAccountMenu,
  CustomerAvatar,
  CustomerBell,
  dateEyebrow,
  dayPhrase,
  fmtPounds,
  fmtSlotTime,
  greetingWord,
  isUnpaidPending,
  NoCleansCard,
  pastDayWord,
  UNPAID_EXPIRY_LINE,
} from '@/components/app/customer';
import { serviceLabelFromSlug } from '@/lib/constants/services';

interface HomeBooking {
  id: string;
  date: string;
  time: string;
  cleanerName: string;
  cleanerImage: string | null;
  serviceType: string;
  duration: number;
  price: number;
  rawStatus: string;
  paymentStatus: string;
  recurring: boolean;
  hasReview: boolean;
}

const UPCOMING_RAW = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'EN_ROUTE',
  'IN_PROGRESS',
];

function toHomeBooking(b: Record<string, unknown>): HomeBooking {
  const cleaner = b.cleaner as { name?: string | null; image?: string | null } | null;
  return {
    id: String(b.id || ''),
    date: typeof b.date === 'string' ? b.date.split('T')[0] : String(b.date),
    time: String(b.startTime || ''),
    cleanerName: cleaner?.name || 'Cleaner being assigned',
    cleanerImage: cleaner?.image ?? null,
    serviceType: String(b.serviceType || 'cleaning'),
    duration: Number(b.duration || 0),
    price: Number(b.totalPrice || 0),
    rawStatus: String(b.status || 'PENDING').toUpperCase(),
    paymentStatus: String(b.paymentStatus || 'PENDING').toUpperCase(),
    recurring: !!(b.agreement as { frequency?: string | null } | null)?.frequency,
    hasReview: !!b.review,
  };
}

export default function CustomerHomePage() {
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [next, setNext] = useState<HomeBooking | null>(null);
  const [unpaid, setUnpaid] = useState<HomeBooking | null>(null);
  // Lane C: an occurrence whose off-session charge FAILED — payment-needed card.
  const [payNeeded, setPayNeeded] = useState<HomeBooking | null>(null);
  const [unreviewed, setUnreviewed] = useState<HomeBooking | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/profile').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/bookings?pageSize=50').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([prof, data]) => {
        const u = prof?.id ? prof : prof?.user;
        if (u?.name) setFirstName(String(u.name).split(' ')[0]);
        const raw: Record<string, unknown>[] = data?.data || [];
        const items = raw.map(toHomeBooking);
        const todayIso = new Date().toISOString().split('T')[0];
        // Honest unpaid state (ruled): unpaid-PENDING is never an upcoming
        // clean — it gets its own card, and the hero never selects it.
        const upcoming = items
          .filter(
            (b) =>
              UPCOMING_RAW.includes(b.rawStatus) &&
              !isUnpaidPending(b.rawStatus, b.paymentStatus) &&
              b.date >= todayIso
          )
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        setNext(upcoming[0] ?? null);
        setUnpaid(
          items.find((b) => isUnpaidPending(b.rawStatus, b.paymentStatus) && b.date >= todayIso) ??
            null
        );
        setPayNeeded(
          items.find(
            (b) => b.rawStatus === 'SCHEDULED' && b.paymentStatus === 'FAILED' && b.date >= todayIso
          ) ?? null
        );
        const pending = items
          .filter((b) => b.rawStatus === 'COMPLETED' && !b.hasReview)
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
        setUnreviewed(pending[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="mb-5">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {dateEyebrow()}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
            {greetingWord()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <CustomerAccountMenu />
            <CustomerBell />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton-pulse h-40 rounded-xl" />
          <div className="skeleton-pulse h-12 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Honest unpaid state — unmissable, above the hero. Finish is the
              primary door; Cancel opens the tracker's own cancel machinery. */}
          {unpaid && (
            <div
              className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4"
              data-testid="home-unpaid-card"
            >
              <p className="font-jost text-[15px] font-semibold text-ink">Payment incomplete</p>
              <p className="mt-1 font-jost text-[13px] text-ink-2">
                {dayPhrase(unpaid.date)}, {fmtSlotTime(unpaid.time)} ·{' '}
                {serviceLabelFromSlug(unpaid.serviceType)} · {fmtPounds(unpaid.price)}
              </p>
              <p className="mt-2 font-jost text-[13px] text-ink-3">{UNPAID_EXPIRY_LINE}</p>
              <div className="mt-3.5 flex gap-2.5">
                <Link
                  href={`/booking/${unpaid.id}/finish`}
                  data-testid="home-finish-door"
                  className="flex-1 rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
                >
                  Finish Payment
                </Link>
                <Link
                  href={`/booking/${unpaid.id}?cancel=1`}
                  className="flex-1 rounded-[10px] border border-danger/30 py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-danger active:bg-danger/[0.06]"
                >
                  Cancel
                </Link>
              </div>
            </div>
          )}

          {/* Lane C (James-ruled): FAILED occurrence — payment-needed card
              above the hero; the hero stays reserved for paid cleans. */}
          {payNeeded && (
            <div
              className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4"
              data-testid="home-payneeded-card"
            >
              <p className="font-jost text-[15px] font-semibold text-ink">Payment needed</p>
              <p className="mt-1 font-jost text-[13px] text-ink-2">
                {dayPhrase(payNeeded.date)}, {fmtSlotTime(payNeeded.time)} ·{' '}
                {serviceLabelFromSlug(payNeeded.serviceType)} · {fmtPounds(payNeeded.price)}
              </p>
              <p className="mt-2 font-jost text-[13px] text-ink-3">
                Your saved card couldn&rsquo;t be charged for this regular clean. Pay now to keep
                your slot.
              </p>
              <Link
                href={`/pay/${payNeeded.id}`}
                data-testid="home-paynow-door"
                className="mt-3.5 block rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
              >
                Pay Now
              </Link>
            </div>
          )}

          {next ? (
            <section
              className="rounded-xl border border-line bg-surface p-4"
              data-testid="next-clean-hero"
            >
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Your Next Clean
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="font-jost text-[20px] font-semibold text-primary">
                  {dayPhrase(next.date)}, {fmtSlotTime(next.time)}
                </p>
                <p className="font-jost text-[20px] font-semibold text-ink">
                  {fmtPounds(next.price)}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <CustomerAvatar photo={next.cleanerImage} name={next.cleanerName} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-jost text-[15px] font-medium text-ink">
                    {next.cleanerName}
                  </p>
                  <p className="font-jost text-[13px] text-ink-3">
                    {serviceLabelFromSlug(next.serviceType)}
                    {next.duration > 0 &&
                      ` · ${next.duration} ${next.duration === 1 ? 'hour' : 'hours'}`}
                    {next.recurring && ' · ↻'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2.5">
                <Link
                  href={`/booking/${next.id}`}
                  className="flex-1 rounded-[10px] bg-primary py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
                >
                  View Details
                </Link>
                <Link
                  href={`/messages?bookingId=${next.id}`}
                  className="flex-1 rounded-[10px] border border-line bg-surface py-3 text-center font-jost text-[12px] font-semibold uppercase tracking-[0.1em] text-ink active:bg-page"
                >
                  Message
                </Link>
              </div>
            </section>
          ) : (
            <NoCleansCard />
          )}

          {unreviewed && (
            <Link
              href={`/account/bookings?review=${unreviewed.id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-page"
              data-testid="review-card"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-jost text-[15px] font-semibold text-ink">
                  How Was {pastDayWord(unreviewed.date)} Clean?
                </span>
                <span className="block truncate font-jost text-[13px] text-ink-3">
                  {unreviewed.cleanerName} · {serviceLabelFromSlug(unreviewed.serviceType)} ·{' '}
                  {new Date(`${unreviewed.date}T00:00:00`).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </span>
              <span className="shrink-0 font-jost text-[13px] font-semibold text-primary">
                Review ›
              </span>
            </Link>
          )}

          {next && (
            <Link
              href="/app/book"
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 active:bg-page"
              data-testid="book-row"
            >
              <span className="font-jost text-[15px] font-medium text-ink">Book A Clean</span>
              <span className="font-jost text-[15px] font-semibold text-primary">›</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
