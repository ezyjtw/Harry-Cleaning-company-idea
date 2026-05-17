'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

type Period = 'week' | 'month' | 'year';

interface Payout {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  reference: string;
  bookingCount: number;
}

interface ServiceBreakdown {
  type: string;
  count: number;
  amount: number;
}

interface EarningsData {
  totalEarnings: number;
  platformCommission: number;
  netEarnings: number;
  bookingCount: number;
  payouts: Payout[];
  breakdown: ServiceBreakdown[];
}

const periodLabels: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

export default function EarningsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(
    async (p: Period) => {
      setLoading(true);
      const res = await fetch(`/api/cleaner/earnings?period=${p}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    fetchEarnings(period);
  }, [period, fetchEarnings]);

  const getStatusBadge = (status: Payout['status']) => {
    const styles = {
      completed: 'bg-gold/10 text-gold',
      pending: 'bg-ink/5 text-ink-3',
      processing: 'bg-ink/5 text-ink-2',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-cormorant text-2xl font-light text-ink">Earnings</h1>
          <p className="font-jost text-sm font-light text-ink-3 mt-1">
            Track your income and payouts
          </p>
        </div>
        <div
          className="flex gap-1 bg-cream-2 p-1"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 font-jost text-xs transition-colors ${
                period === p ? 'bg-ink text-cream' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-ink/5" />
            ))}
          </div>
          <div className="h-64 bg-ink/5" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Gross Earnings
              </p>
              <p className="font-cormorant text-3xl font-light text-ink mt-1">
                £{(data.totalEarnings + data.platformCommission).toFixed(2)}
              </p>
              <p className="font-jost text-xs font-light text-ink-3 mt-1">
                {data.bookingCount} completed bookings
              </p>
            </div>
            <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Platform Fees
              </p>
              <p className="font-cormorant text-3xl font-light text-ink mt-1">
                -£{data.platformCommission.toFixed(2)}
              </p>
              <p className="font-jost text-xs font-light text-ink-3 mt-1">Commission deducted</p>
            </div>
            <div className="bg-gold/5 p-5" style={{ border: '0.5px solid rgba(184,151,90,0.2)' }}>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                Net Earnings
              </p>
              <p className="font-cormorant text-3xl font-light text-ink mt-1">
                £{data.netEarnings.toFixed(2)}
              </p>
              <p className="font-jost text-xs font-light text-gold mt-1">Amount paid to you</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payout history */}
            <div
              className="lg:col-span-2 bg-cream-2 overflow-hidden"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div className="px-6 py-4" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h2 className="font-cormorant text-lg font-light text-ink">Payout History</h2>
              </div>
              {data.payouts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-jost text-sm font-light text-ink-3">
                    No completed bookings in this period
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
                        <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Date
                        </th>
                        <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Amount
                        </th>
                        <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Jobs
                        </th>
                        <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Status
                        </th>
                        <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((payout) => (
                        <tr
                          key={payout.id}
                          className="hover:bg-cream/50 transition-colors"
                          style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                        >
                          <td className="px-6 py-4 font-jost text-sm font-light text-ink">
                            {payout.date}
                          </td>
                          <td className="px-6 py-4 font-jost text-sm font-normal text-ink">
                            £{payout.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 font-jost text-sm font-light text-ink-3">
                            {payout.bookingCount}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                          <td className="px-6 py-4 font-jost text-sm font-light text-ink-3 font-mono">
                            {payout.reference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Service breakdown */}
            <div
              className="bg-cream-2 overflow-hidden"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div className="px-6 py-4" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h2 className="font-cormorant text-lg font-light text-ink">By Service Type</h2>
              </div>
              {data.breakdown.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-jost text-sm font-light text-ink-3">No data yet</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {data.breakdown.map((item) => {
                    const maxAmount = Math.max(...data.breakdown.map((b) => b.amount), 1);
                    const percentage = (item.amount / maxAmount) * 100;
                    return (
                      <div key={item.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-jost text-sm font-light text-ink">{item.type}</span>
                          <span className="font-jost text-sm font-light text-ink-3">
                            £{item.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-cream overflow-hidden">
                          <div className="h-full bg-gold" style={{ width: `${percentage}%` }} />
                        </div>
                        <p className="font-jost text-xs font-light text-ink-3 mt-1">
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
    </div>
  );
}
