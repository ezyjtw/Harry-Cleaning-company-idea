'use client';

// W7 (James-ruled, copy locked 7 Sep 2026): earnings rebuilt to the approved
// mockup — serif money, tracking-caps labels, breathing room, plain-English
// status lines, initial-avatars, no shouty pills. Hero = period total +
// week sparkline + two stat tiles ("Paid to you" / "On its way", teal for
// money-in-motion) that ALWAYS sum to the headline (server-guaranteed:
// paidOut + pendingRelease = totalEarnings on one ledger). Below: On-its-way
// rows ("Review window ends ~{day}" from releaseDueAt — the ~ carries the
// scheduler lag) and Paid rows ("Paid {day} — usually reaches your bank in a
// few working days"). Release is what we know, release is what we say — the
// app never claims to know bank-arrival day. This rebuild also retires the
// dead `payouts` field the old page read (removed by H79 server-side), which
// had left the shell's payout cards silently empty.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

type Period = 'week' | 'month' | 'year';

interface EarningsJob {
  id: string;
  customerName: string;
  serviceType: string;
  amount: number;
  completedAt: string | null;
  released: boolean;
  releaseDueAt: string | null;
  paidAt: string | null;
}

interface EarningsData {
  totalEarnings: number;
  netEarnings: number;
  paidOut: number;
  pendingRelease: number;
  bookingCount: number;
  jobs: EarningsJob[];
  days: { date: string; amount: number }[];
  breakdown: { type: string; count: number; amount: number }[];
}

const PERIOD_LABEL: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year' };
const PERIOD_PHRASE: Record<Period, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function dayPhrase(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 1 && diffDays <= 6) {
    return d.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The plain-English release line for a not-yet-released job. */
function releaseLine(job: EarningsJob): string {
  if (!job.releaseDueAt) return 'After the review window';
  const due = new Date(job.releaseDueAt).getTime();
  if (due <= Date.now()) return 'Releasing shortly';
  return `Review window ends ~${dayPhrase(job.releaseDueAt)}`;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-page font-jost text-[12px] font-semibold text-ink-2 ring-1 ring-line">
      {initials(name)}
    </span>
  );
}

function JobRow({ job, line, lineClass }: { job: EarningsJob; line: string; lineClass: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={job.customerName} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-jost text-sm font-medium text-ink">{job.customerName}</p>
        <p className={`font-jost text-[12px] ${lineClass}`}>{line}</p>
      </div>
      <p className="font-newsreader text-lg font-medium text-ink">£{job.amount.toFixed(2)}</p>
    </div>
  );
}

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

  // Quiet 7-bar sparkline: this week's EARNED net bucketed Mon→Sun (the old
  // page bucketed a payouts field the API no longer returns — always empty).
  const bars: number[] = (() => {
    const buckets = Array(7).fill(0);
    for (const d of weekData?.days ?? []) {
      const day = new Date(`${d.date}T00:00:00`).getDay(); // 0=Sun
      buckets[day === 0 ? 6 : day - 1] += d.amount;
    }
    return buckets;
  })();
  const maxBar = Math.max(...bars, 1);

  const onItsWay = data?.jobs.filter((j) => !j.released) ?? [];
  const paid = data?.jobs.filter((j) => j.released) ?? [];

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
          <div className="h-44 animate-pulse rounded-2xl bg-line" />
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Hero: period total + week sparkline (net-first law) */}
          <div className="rounded-2xl bg-primary p-5 text-white shadow-sm">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Earned {PERIOD_PHRASE[period]}
            </p>
            <p className="mt-1 font-newsreader text-[40px] font-semibold leading-none">
              £{data.netEarnings.toFixed(2)}
            </p>
            <p className="mt-2 font-jost text-[13px] text-white/70">
              {data.bookingCount} completed booking{data.bookingCount === 1 ? '' : 's'}
            </p>
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

          {/* The two tiles — always summing to the headline (one ledger). */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Paid to you
              </p>
              <p className="mt-1 font-newsreader text-2xl font-semibold text-ink">
                £{data.paidOut.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-teal-600/25 bg-teal-600/5 p-4">
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                On its way
              </p>
              <p className="mt-1 font-newsreader text-2xl font-semibold text-teal-700">
                £{data.pendingRelease.toFixed(2)}
              </p>
            </div>
          </div>

          {/* On its way — money-in-motion rows */}
          {onItsWay.length > 0 && (
            <div>
              <h2 className="mb-2 font-newsreader text-base font-semibold text-ink">On its way</h2>
              <div className="divide-y divide-line/60 rounded-2xl border border-teal-600/25 bg-surface">
                {onItsWay.map((j) => (
                  <JobRow key={j.id} job={j} line={releaseLine(j)} lineClass="text-teal-700" />
                ))}
              </div>
            </div>
          )}

          {/* Paid — release is what we know, release is what we say */}
          <div>
            <h2 className="mb-2 font-newsreader text-base font-semibold text-ink">Paid</h2>
            {paid.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface p-4 font-jost text-sm text-ink-3">
                Nothing paid {PERIOD_PHRASE[period]} yet.
              </p>
            ) : (
              <div className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
                {paid.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    line={
                      j.paidAt
                        ? `Paid ${dayPhrase(j.paidAt)} — usually reaches your bank in a few working days`
                        : 'Paid — usually reaches your bank in a few working days'
                    }
                    lineClass="text-ink-3"
                  />
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

          {/* Statements — one chevron row */}
          <Link
            href="/cleaner/earnings"
            className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 active:bg-page"
          >
            <span className="font-jost text-sm font-medium text-ink">Statements &amp; tax</span>
            <svg
              className="h-4 w-4 text-ink-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
