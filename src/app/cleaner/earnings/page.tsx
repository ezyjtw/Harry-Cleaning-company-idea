'use client';

import { useState } from 'react';

type Period = 'week' | 'month' | 'year' | 'custom';

interface Payout {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  reference: string;
}

interface ServiceBreakdown {
  type: string;
  count: number;
  amount: number;
}

const mockPayouts: Payout[] = [
  {
    id: 'P-001',
    date: '2026-03-13',
    amount: 245.0,
    status: 'completed',
    reference: 'PAY-2026031301',
  },
  {
    id: 'P-002',
    date: '2026-03-10',
    amount: 180.5,
    status: 'completed',
    reference: 'PAY-2026031001',
  },
  {
    id: 'P-003',
    date: '2026-03-07',
    amount: 320.0,
    status: 'completed',
    reference: 'PAY-2026030701',
  },
  {
    id: 'P-004',
    date: '2026-03-03',
    amount: 195.0,
    status: 'completed',
    reference: 'PAY-2026030301',
  },
  {
    id: 'P-005',
    date: '2026-02-28',
    amount: 410.0,
    status: 'completed',
    reference: 'PAY-2026022801',
  },
  {
    id: 'P-006',
    date: '2026-03-14',
    amount: 165.0,
    status: 'processing',
    reference: 'PAY-2026031401',
  },
];

const mockBreakdown: ServiceBreakdown[] = [
  { type: 'Regular Clean', count: 12, amount: 720 },
  { type: 'Deep Clean', count: 4, amount: 480 },
  { type: 'End of Tenancy', count: 2, amount: 360 },
  { type: 'AirBnB Turnover', count: 3, amount: 270 },
];

const periodLabels: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  custom: 'Custom',
};

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>('month');

  const totalEarnings = 1830;
  const platformCommission = 183;
  const netEarnings = totalEarnings - platformCommission;

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
        {/* Period selector */}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Total Earnings
          </p>
          <p className="font-cormorant text-3xl font-light text-ink mt-1">
            £{totalEarnings.toFixed(2)}
          </p>
          <p className="font-jost text-xs font-light text-ink-3 mt-1">Before platform commission</p>
        </div>
        <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
            Platform Commission (10%)
          </p>
          <p className="font-cormorant text-3xl font-light text-ink mt-1">
            -£{platformCommission.toFixed(2)}
          </p>
          <p className="font-jost text-xs font-light text-ink-3 mt-1">Commission deducted</p>
        </div>
        <div className="bg-gold/5 p-5" style={{ border: '0.5px solid rgba(184,151,90,0.2)' }}>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold">Net Earnings</p>
          <p className="font-cormorant text-3xl font-light text-ink mt-1">
            £{netEarnings.toFixed(2)}
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
                    Status
                  </th>
                  <th className="text-left px-6 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockPayouts.map((payout) => (
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
                    <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                    <td className="px-6 py-4 font-jost text-sm font-light text-ink-3 font-mono">
                      {payout.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service breakdown */}
        <div
          className="bg-cream-2 overflow-hidden"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-cormorant text-lg font-light text-ink">By Service Type</h2>
          </div>
          <div className="p-6 space-y-4">
            {mockBreakdown.map((item) => {
              const percentage = (item.amount / totalEarnings) * 100;
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-jost text-sm font-light text-ink">{item.type}</span>
                    <span className="font-jost text-sm font-light text-ink-3">£{item.amount}</span>
                  </div>
                  <div className="w-full h-1.5 bg-cream overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${percentage}%` }} />
                  </div>
                  <p className="font-jost text-xs font-light text-ink-3 mt-1">
                    {item.count} bookings
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
