'use client';

// B2 (James-ruled L2-lite): net-first earnings for the shell — big serif
// "You'll receive £X" hero (net-first law), period chips, a quiet 7-bar week
// sparkline, payouts as cards, the service breakdown bar list, and a
// "Statements & tax →" deep-link into the portal page (in-shell). The portal
// earnings page is untouched for browsers.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

type Period = 'week' | 'month' | 'year';

interface Payout {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  reference: string;
  bookingCount: number;
}

interface EarningsData {
  totalEarnings: number;
  netEarnings: number;
  bookingCount: number;
  payouts: Payout[];
  breakdown: { type: string; count: number; amount: number }[];
}

const PERIOD_LABEL: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year' };
const STATUS_STYLE: Record<Payout['status'], string> = {
  completed: 'bg-primary-soft text-primary',
  pending: 'bg-page text-ink-3',
  processing: 'bg-page text-ink-2',
};

export default function AppEarningsPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<EarningsData | null>(null);
  const [weekData, setWeekData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchAll = useCallback(async (p: Period) => {
    setLoadError(false);
    try {
      const [main, week] = await Promise.all([
        fetch(`/api/cleaner/earnings?period=${p}`),
        p === 'week' ? null : fetch('/api/cleaner/earnings?period=week'),
      ]);
      if (!main.ok) {
        setLoadError(true);
        return;
      }
      const d = await main.json();
      setData(d);
      if (week && week.ok) setWeekData(await week.json());
      else if (p === 'week') setWeekData(d);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll(period);
  }, [fetchAll, period]);

  useEffect(() => {
    (window as unknown as { __renaRefresh?: () => void }).__renaRefresh = () => fetchAll(period);
    return () => {
      delete (window as unknown as { __renaRefresh?: () => void }).__renaRefresh;
    };
  }, [fetchAll, period]);

  // Quiet 7-bar sparkline: this week's payout amounts bucketed Mon→Sun.
  const bars: number[] = (() => {
    const buckets = Array(7).fill(0);
    for (const p of weekData?.payouts ?? []) {
      const day = new Date(p.date).getDay(); // 0=Sun
      buckets[day === 0 ? 6 : day - 1] += p.amount;
    }
    return buckets;
  })();
  const maxBar = Math.max(...bars, 1);

  if (!loading && loadError && !data) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-newsreader text-xl font-semibold text-ink">
          Couldn&apos;t load your earnings
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchAll(period);
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-newsreader text-[26px] font-semibold leading-tight text-ink">
          Earnings
        </h1>
        <div className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                haptic('light');
                setPeriod(p);
              }}
              className={`rounded-full px-4 py-1.5 font-jost text-sm font-medium transition-colors ${
                period === p ? 'bg-primary text-white' : 'text-ink-2'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="h-36 animate-pulse rounded-2xl bg-line" />
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Net-first hero (net-first law: what the cleaner actually receives) */}
          <div className="rounded-2xl bg-primary p-5 text-white shadow-sm">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              You&apos;ll receive
            </p>
            <p className="mt-1 font-newsreader text-[40px] font-semibold leading-none">
              £{data.netEarnings.toFixed(2)}
            </p>
            <p className="mt-2 font-jost text-[13px] text-white/70">
              {data.bookingCount} completed booking{data.bookingCount === 1 ? '' : 's'} this{' '}
              {period}
            </p>

            {/* Quiet 7-bar week sparkline (Mon→Sun, always this week) */}
            <div className="mt-4 flex h-10 items-end gap-1.5">
              {bars.map((b, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-white/25"
                  style={{ height: `${Math.max(8, (b / maxBar) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-jost text-[9px] uppercase tracking-wider text-white/40">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} className="flex-1 text-center">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Payout cards */}
          <div>
            <h2 className="mb-2 font-newsreader text-base font-semibold text-ink">Payouts</h2>
            {data.payouts.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface p-4 font-jost text-sm text-ink-3">
                No payouts in this period yet.
              </p>
            ) : (
              <div className="space-y-2">
                {data.payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="font-jost text-sm font-medium text-ink">
                        {new Date(p.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="font-jost text-[12px] text-ink-3">
                        {p.bookingCount} job{p.bookingCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-newsreader text-lg font-medium text-ink">
                        £{p.amount.toFixed(2)}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_STYLE[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service breakdown bar list */}
          {data.breakdown.length > 0 && (
            <div>
              <h2 className="mb-2 font-newsreader text-base font-semibold text-ink">By service</h2>
              <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
                {data.breakdown.map((b) => {
                  const maxAmt = Math.max(...data.breakdown.map((x) => x.amount), 1);
                  return (
                    <div key={b.type}>
                      <div className="flex justify-between font-jost text-[13px] text-ink-2">
                        <span>
                          {b.type} · {b.count}
                        </span>
                        <span className="font-medium text-ink">£{b.amount.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-page">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${(b.amount / maxAmt) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Link
            href="/cleaner/earnings"
            className="block rounded-2xl border border-line bg-surface px-4 py-3.5 text-center font-jost text-sm font-medium text-primary active:bg-page"
          >
            Statements &amp; tax →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
