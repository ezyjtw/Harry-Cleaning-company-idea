'use client';

import { signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import CleanerStatements from '@/components/cleaner/CleanerStatements';
import { serviceLabelFromSlug } from '@/lib/constants/services';

// H79: restyled to the portal's design grammar (the calendar page and
// dashboard are the reference — rounded-xl hairline cards, Newsreader
// headings/figures, Jost labels, rounded-full chips) and rebuilt on the
// honest data shape: net-first with a real paid-out / pending-release split,
// earnings-by-day with true release state (the old "Payout History" invented
// payout references and stamped everything "completed").

type Period = 'week' | 'month' | 'year';

interface EarningsDay {
  date: string;
  amount: number;
  released: number;
  pending: number;
  bookingCount: number;
}

interface ServiceBreakdown {
  type: string;
  count: number;
  amount: number;
}

interface EarningsData {
  totalEarnings: number;
  netEarnings: number;
  paidOut: number;
  pendingRelease: number;
  bookingCount: number;
  days: EarningsDay[];
  breakdown: ServiceBreakdown[];
}

const periodLabels: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // P1 (ledger): Stripe Express payouts dashboard door.
  const [payoutsOpening, setPayoutsOpening] = useState(false);
  const [payoutsError, setPayoutsError] = useState('');

  const openPayoutsDashboard = async () => {
    setPayoutsOpening(true);
    setPayoutsError('');
    try {
      const res = await fetch('/api/cleaner/stripe/login-link', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) {
        window.open(d.url, '_blank', 'noopener,noreferrer');
      } else {
        setPayoutsError(d.error || 'Could not open your payouts dashboard.');
      }
    } catch {
      setPayoutsError('Could not open your payouts dashboard.');
    } finally {
      setPayoutsOpening(false);
    }
  };

  const fetchEarnings = useCallback(async (p: Period) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/cleaner/earnings?period=${p}`);
      if (res.status === 401) {
        // R3: signOut (not router.push) — clears the stale cookie so /login
        // renders instead of middleware bouncing back to /dashboard.
        signOut({ callbackUrl: '/login' });
        return;
      }
      if (res.ok) {
        setData(await res.json());
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  // A8 (shell only): native pull-to-refresh hook.
  useEffect(() => {
    if (!/RenaPro/.test(navigator.userAgent)) return;
    const w = window as unknown as { __renaRefresh?: () => void };
    w.__renaRefresh = () => fetchEarnings(period);
    return () => {
      delete w.__renaRefresh;
    };
  }, [fetchEarnings, period]);

  useEffect(() => {
    fetchEarnings(period);
  }, [period, fetchEarnings]);

  // Honest release chip for a day: all released / all pending / a mix.
  const dayChip = (day: EarningsDay) => {
    if (day.pending <= 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-trust/10 px-2 py-0.5 font-jost text-xs font-medium text-trust">
          Paid out
        </span>
      );
    }
    if (day.released <= 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-jost text-xs font-medium text-amber-800">
          Pending release
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-jost text-xs font-medium text-amber-800">
        £{day.pending.toFixed(2)} pending
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Earnings</h1>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">
            Track your income and payouts
          </p>
          <button
            onClick={openPayoutsDashboard}
            disabled={payoutsOpening}
            className="mt-2 inline-flex items-center rounded-[10px] border border-line bg-surface px-3 py-1.5 font-jost text-xs font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
          >
            {payoutsOpening ? 'Opening…' : 'View payouts in Stripe'}
          </button>
          {payoutsError && <p className="mt-1 font-jost text-xs text-danger">{payoutsError}</p>}
        </div>
        {/* Period toggle — calendar-page segmented grammar. */}
        <div className="flex overflow-hidden rounded-[10px] border border-line">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 font-jost text-sm transition-colors ${
                period === p ? 'bg-primary text-white' : 'bg-surface text-ink-2 hover:bg-page'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {!loading && loadError && (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <h2 className="font-newsreader text-lg font-semibold text-ink">
            Couldn&apos;t load your earnings
          </h2>
          <p className="mt-1 font-jost text-sm text-ink-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => fetchEarnings(period)}
            className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-line" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-line" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards — net-first (standing rule), with the honest
              paid-out / pending-release split. earned = paid + pending. */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-primary">
                You&apos;ll receive
              </p>
              <p className="mt-1 font-newsreader text-3xl font-medium text-ink">
                £{data.netEarnings.toFixed(2)}
              </p>
              <p className="mt-1 font-jost text-xs font-light text-ink-3">
                Net earned across {data.bookingCount} completed booking
                {data.bookingCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Paid out
              </p>
              <p className="mt-1 font-newsreader text-3xl font-medium text-ink">
                £{data.paidOut.toFixed(2)}
              </p>
              <p className="mt-1 font-jost text-xs font-light text-ink-3">
                Released to your account
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Pending release
              </p>
              <p className="mt-1 font-newsreader text-3xl font-medium text-ink">
                £{data.pendingRelease.toFixed(2)}
              </p>
              <p className="mt-1 font-jost text-xs font-light text-ink-3">
                Releases after each job&apos;s confirmation window
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Earnings by day — the honest ledger (real release state per day). */}
            <div className="overflow-hidden rounded-xl border border-line bg-surface lg:col-span-2">
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-newsreader text-lg font-semibold text-ink">Earnings by day</h2>
              </div>
              {data.days.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-jost text-sm font-light text-ink-3">
                    No completed bookings in this period
                  </p>
                </div>
              ) : (
                <div>
                  {data.days.map((day) => (
                    <div
                      key={day.date}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line px-6 py-3.5 first:border-t-0"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="font-jost text-sm text-ink">{fmtDay(day.date)}</span>
                        <span className="font-jost text-xs font-light text-ink-3">
                          {day.bookingCount} job{day.bookingCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        {dayChip(day)}
                        <span className="font-newsreader text-lg font-medium text-ink">
                          £{day.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Service breakdown */}
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-newsreader text-lg font-semibold text-ink">By service type</h2>
              </div>
              {data.breakdown.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-jost text-sm font-light text-ink-3">No data yet</p>
                </div>
              ) : (
                <div className="space-y-4 p-6">
                  {data.breakdown.map((item) => {
                    const maxAmount = Math.max(...data.breakdown.map((b) => b.amount), 1);
                    const percentage = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.type}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-jost text-sm text-ink">
                            {serviceLabelFromSlug(item.type)}
                          </span>
                          <span className="font-newsreader text-sm font-medium text-ink">
                            £{item.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-page">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="mt-1 font-jost text-xs font-light text-ink-3">
                          {item.count} booking{item.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* A13: self-serve earnings statements (always available, independent of the period toggle) */}
      <CleanerStatements />
    </div>
  );
}
