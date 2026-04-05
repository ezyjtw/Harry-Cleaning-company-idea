'use client';

import { useState, useEffect } from 'react';

import { useCompany } from '../_context/CompanyContext';

// ─── Types ──────────────────────────────────────────────────

interface RevenueTrend {
  period: string;
  revenue: number;
  bookings: number;
  platformFees: number;
  cleanerEarnings: number;
}

interface ServiceBreakdown {
  serviceType: string;
  bookings: number;
  revenue: number;
  avgValue: number;
  percentage: number;
}

interface TeamMemberPerformance {
  userId: string;
  name: string;
  completedJobs: number;
  totalRevenue: number;
  avgRating: number;
  avgJobDuration: number;
  cancellationRate: number;
  ratingBreakdown: { thoroughness: number; punctuality: number; communication: number };
}

interface CustomerMetrics {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  avgBookingsPerCustomer: number;
  avgSpendPerCustomer: number;
  avgSpendPerBooking: number;
  topCustomers: { name: string; bookings: number; totalSpent: number }[];
}

interface OperationalMetrics {
  avgResponseTimeMinutes: number;
  avgCompletionTimeHours: number;
  onTimeRate: number;
  completionRate: number;
  cancellationRate: number;
  cancellationReasons: { reason: string; count: number }[];
  bookingsByDayOfWeek: { day: string; count: number }[];
  peakHours: { hour: string; count: number }[];
}

interface QualityMetrics {
  avgRating: number;
  totalReviews: number;
  ratingDistribution: { stars: number; count: number }[];
  avgThoroughness: number;
  avgPunctuality: number;
  avgCommunication: number;
  complaintsTotal: number;
  complaintsByCategory: { category: string; count: number }[];
  disputeRate: number;
}

interface FinancialMetrics {
  totalRevenue: number;
  totalPlatformFees: number;
  totalCleanerEarnings: number;
  platformMarginPercent: number;
  avgBookingValue: number;
  refundTotal: number;
  refundRate: number;
  revenuePerTeamMember: number;
  addonRevenue: number;
  addonAttachmentRate: number;
}

interface AnalyticsData {
  revenueTrends: RevenueTrend[];
  serviceBreakdown: ServiceBreakdown[];
  teamPerformance: TeamMemberPerformance[];
  customerMetrics: CustomerMetrics;
  operationalMetrics: OperationalMetrics;
  qualityMetrics: QualityMetrics;
  financialMetrics: FinancialMetrics;
}

type TabId = 'overview' | 'financial' | 'team' | 'customers' | 'operations' | 'quality';

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(v: number) {
  return `\u00a3${v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value, sub, color = 'gray' }: { label: string; value: string; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-white text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.gray}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1.5 opacity-60">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function BarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-gray-500">{d.value > 0 ? formatCurrency(d.value) : ''}</span>
          <div
            className="w-full bg-green-500 rounded-t-sm transition-all hover:bg-green-600"
            style={{ height: `${maxValue > 0 ? (d.value / maxValue) * 100 : 0}%`, minHeight: d.value > 0 ? '4px' : '0' }}
          />
          <span className="text-[10px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBar({ label, value, max, color = 'green' }: { label: string; value: number; max: number; color?: string }) {
  const colorClass = color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-yellow-500' : color === 'blue' ? 'bg-blue-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className="text-gray-500">{value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { company } = useCompany();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [months, setMonths] = useState(6);

  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);
    fetch(`/api/companies/${company.id}/analytics?full=true&months=${months}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id, months]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        No analytics data available yet.
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'financial', label: 'Financial' },
    { id: 'team', label: 'Team' },
    { id: 'customers', label: 'Customers' },
    { id: 'operations', label: 'Operations' },
    { id: 'quality', label: 'Quality' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Deep insights to drive your business decisions.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Period:</label>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'financial' && <FinancialTab data={data} />}
      {activeTab === 'team' && <TeamTab data={data} />}
      {activeTab === 'customers' && <CustomersTab data={data} />}
      {activeTab === 'operations' && <OperationsTab data={data} />}
      {activeTab === 'quality' && <QualityTab data={data} />}
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsData }) {
  const { financialMetrics: f, operationalMetrics: o, qualityMetrics: q, customerMetrics: c } = data;
  const maxRev = Math.max(...data.revenueTrends.map((t) => t.revenue));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(f.totalRevenue)} color="green" />
        <StatCard label="Avg Booking" value={formatCurrency(f.avgBookingValue)} color="blue" />
        <StatCard label="Completion Rate" value={`${o.completionRate}%`} color="teal" />
        <StatCard label="Avg Rating" value={`${q.avgRating.toFixed(1)}/5`} sub={`${q.totalReviews} reviews`} color="amber" />
        <StatCard label="Repeat Rate" value={`${c.repeatRate}%`} sub={`${c.repeatCustomers} returning`} color="purple" />
        <StatCard label="Refund Rate" value={`${f.refundRate}%`} sub={formatCurrency(f.refundTotal)} color={f.refundRate > 5 ? 'red' : 'gray'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <SectionCard title="Revenue Trend" subtitle="Monthly completed booking revenue">
          <BarChart
            data={data.revenueTrends.map((t) => ({ label: t.period.split('-')[1], value: t.revenue }))}
            maxValue={maxRev}
          />
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {data.revenueTrends.reduce((s, t) => s + t.bookings, 0)}
              </p>
              <p className="text-xs text-gray-500">Total Bookings</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.revenueTrends.reduce((s, t) => s + t.revenue, 0))}
              </p>
              <p className="text-xs text-gray-500">Total Revenue</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.revenueTrends.reduce((s, t) => s + t.platformFees, 0))}
              </p>
              <p className="text-xs text-gray-500">Platform Fees</p>
            </div>
          </div>
        </SectionCard>

        {/* Service Mix */}
        <SectionCard title="Service Mix" subtitle="Revenue breakdown by service type">
          <div className="space-y-4">
            {data.serviceBreakdown.map((s) => (
              <div key={s.serviceType}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{s.serviceType}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{s.bookings} bookings</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(s.revenue)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${s.percentage}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{s.percentage}% of revenue</span>
                  <span className="text-[10px] text-gray-400">avg {formatCurrency(s.avgValue)}/booking</span>
                </div>
              </div>
            ))}
            {data.serviceBreakdown.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No service data yet.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Financial Tab ──────────────────────────────────────────

function FinancialTab({ data }: { data: AnalyticsData }) {
  const f = data.financialMetrics;
  const maxRev = Math.max(...data.revenueTrends.map((t) => t.revenue));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(f.totalRevenue)} color="green" />
        <StatCard label="Cleaner Earnings" value={formatCurrency(f.totalCleanerEarnings)} color="blue" />
        <StatCard label="Platform Fees" value={formatCurrency(f.totalPlatformFees)} sub={`${f.platformMarginPercent}% margin`} color="purple" />
        <StatCard label="Revenue / Member" value={formatCurrency(f.revenuePerTeamMember)} color="teal" />
        <StatCard label="Avg Booking Value" value={formatCurrency(f.avgBookingValue)} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Revenue vs Costs" subtitle="Monthly revenue, cleaner earnings, and platform fees">
          <BarChart
            data={data.revenueTrends.map((t) => ({ label: t.period.split('-')[1], value: t.revenue }))}
            maxValue={maxRev}
          />
          <div className="mt-4 space-y-2 pt-4 border-t border-gray-100">
            {data.revenueTrends.map((t) => (
              <div key={t.period} className="flex justify-between text-xs">
                <span className="text-gray-500">{t.period}</span>
                <div className="flex gap-4">
                  <span className="text-gray-700">{formatCurrency(t.revenue)} rev</span>
                  <span className="text-blue-600">{formatCurrency(t.cleanerEarnings)} paid out</span>
                  <span className="text-purple-600">{formatCurrency(t.platformFees)} fees</span>
                  <span className="text-gray-400">{t.bookings} jobs</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Refunds & Add-ons" subtitle="Revenue quality indicators">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-700">Refunds</p>
                <p className="text-2xl font-bold text-red-800 mt-1">{formatCurrency(f.refundTotal)}</p>
                <p className="text-xs text-red-600 mt-1">{f.refundRate}% of bookings</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-700">Add-on Revenue</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{formatCurrency(f.addonRevenue)}</p>
                <p className="text-xs text-green-600 mt-1">{f.addonAttachmentRate}% attachment rate</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue by Service Type</h4>
              {data.serviceBreakdown.map((s) => (
                <div key={s.serviceType} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{s.serviceType}</span>
                  <div className="flex gap-4">
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(s.revenue)}</span>
                    <span className="text-xs text-gray-400">{s.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Team Tab ──────────────────────────────────────────

function TeamTab({ data }: { data: AnalyticsData }) {
  const team = [...data.teamPerformance].sort((a, b) => b.completedJobs - a.completedJobs);
  const maxJobs = Math.max(...team.map((t) => t.completedJobs), 1);
  const maxRevenue = Math.max(...team.map((t) => t.totalRevenue), 1);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Team Size" value={String(team.length)} color="blue" />
        <StatCard label="Total Jobs" value={String(team.reduce((s, t) => s + t.completedJobs, 0))} color="green" />
        <StatCard
          label="Avg Rating"
          value={(team.reduce((s, t) => s + t.avgRating, 0) / (team.length || 1)).toFixed(1)}
          color="amber"
        />
        <StatCard
          label="Avg Jobs / Member"
          value={(team.reduce((s, t) => s + t.completedJobs, 0) / (team.length || 1)).toFixed(0)}
          color="purple"
        />
      </div>

      {/* Individual performance */}
      <SectionCard title="Individual Performance" subtitle="Detailed breakdown per team member">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Jobs</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg Duration</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Cancel %</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Thoroughness</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Punctuality</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Comms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {team.map((m, i) => (
                <tr key={m.userId} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-3 text-sm text-gray-700">{m.completedJobs}</td>
                  <td className="text-right py-3 px-3 text-sm font-medium text-gray-900">{formatCurrency(m.totalRevenue)}</td>
                  <td className="text-right py-3 px-3">
                    <span className={`text-sm font-medium ${m.avgRating >= 4.5 ? 'text-green-600' : m.avgRating >= 4.0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {m.avgRating > 0 ? m.avgRating.toFixed(1) : 'N/A'}
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 text-sm text-gray-600 hidden md:table-cell">
                    {m.avgJobDuration > 0 ? `${m.avgJobDuration.toFixed(1)}h` : '-'}
                  </td>
                  <td className="text-right py-3 px-3 hidden md:table-cell">
                    <span className={`text-sm ${m.cancellationRate > 10 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {m.cancellationRate}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 text-sm text-gray-600 hidden lg:table-cell">
                    {m.ratingBreakdown.thoroughness > 0 ? m.ratingBreakdown.thoroughness.toFixed(1) : '-'}
                  </td>
                  <td className="text-right py-3 px-3 text-sm text-gray-600 hidden lg:table-cell">
                    {m.ratingBreakdown.punctuality > 0 ? m.ratingBreakdown.punctuality.toFixed(1) : '-'}
                  </td>
                  <td className="text-right py-3 px-3 text-sm text-gray-600 hidden lg:table-cell">
                    {m.ratingBreakdown.communication > 0 ? m.ratingBreakdown.communication.toFixed(1) : '-'}
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-sm text-gray-400">No team data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Visual comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Jobs by Team Member">
          <div className="space-y-3">
            {team.map((m) => (
              <HorizontalBar key={m.userId} label={m.name} value={m.completedJobs} max={maxJobs} />
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Revenue by Team Member">
          <div className="space-y-3">
            {team.map((m) => (
              <HorizontalBar key={m.userId} label={m.name} value={Math.round(m.totalRevenue)} max={maxRevenue} color="blue" />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Customers Tab ──────────────────────────────────────────

function CustomersTab({ data }: { data: AnalyticsData }) {
  const c = data.customerMetrics;
  const maxSpent = Math.max(...c.topCustomers.map((t) => t.totalSpent), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Customers" value={String(c.totalCustomers)} color="blue" />
        <StatCard label="Repeat Customers" value={String(c.repeatCustomers)} color="green" />
        <StatCard label="Repeat Rate" value={`${c.repeatRate}%`} color={c.repeatRate >= 50 ? 'green' : 'amber'} />
        <StatCard label="Avg Bookings / Customer" value={c.avgBookingsPerCustomer.toFixed(1)} color="purple" />
        <StatCard label="Avg Spend / Customer" value={formatCurrency(c.avgSpendPerCustomer)} color="teal" />
        <StatCard label="Avg Spend / Booking" value={formatCurrency(c.avgSpendPerBooking)} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Customers by Spend" subtitle="Your highest-value customers">
          <div className="space-y-3">
            {c.topCustomers.map((cust, i) => (
              <div key={cust.name + i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cust.name}</p>
                    <p className="text-xs text-gray-400">{cust.bookings} bookings</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(cust.totalSpent)}</span>
              </div>
            ))}
            {c.topCustomers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No customer data yet.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Customer Lifetime Value" subtitle="Spend distribution across your customer base">
          <div className="space-y-3">
            {c.topCustomers.map((cust, i) => (
              <HorizontalBar key={cust.name + i} label={cust.name} value={Math.round(cust.totalSpent)} max={maxSpent} color="green" />
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-700">Retention insight</p>
            <p className="text-xs text-blue-600 mt-1">
              {c.repeatRate >= 50
                ? `Strong repeat rate at ${c.repeatRate}%. Your customers are coming back.`
                : c.repeatRate >= 25
                  ? `${c.repeatRate}% repeat rate. Consider loyalty incentives to boost retention.`
                  : `Low repeat rate at ${c.repeatRate}%. Focus on post-service follow-ups and quality consistency.`}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Operations Tab ──────────────────────────────────────────

function OperationsTab({ data }: { data: AnalyticsData }) {
  const o = data.operationalMetrics;
  const maxDayCount = Math.max(...o.bookingsByDayOfWeek.map((d) => d.count), 1);
  const maxHourCount = Math.max(...o.peakHours.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Completion Rate" value={`${o.completionRate}%`} color={o.completionRate >= 90 ? 'green' : 'amber'} />
        <StatCard label="Cancellation Rate" value={`${o.cancellationRate}%`} color={o.cancellationRate <= 5 ? 'green' : o.cancellationRate <= 15 ? 'amber' : 'red'} />
        <StatCard label="On-Time Rate" value={`${o.onTimeRate}%`} color={o.onTimeRate >= 90 ? 'green' : 'amber'} />
        <StatCard label="Avg Response" value={`${o.avgResponseTimeMinutes.toFixed(0)}min`} sub="booking to acceptance" color="blue" />
        <StatCard label="Avg Completion" value={`${o.avgCompletionTimeHours.toFixed(1)}h`} sub="acceptance to done" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Bookings by Day of Week" subtitle="When your customers book most">
          <div className="space-y-3">
            {o.bookingsByDayOfWeek.map((d) => (
              <HorizontalBar key={d.day} label={d.day} value={d.count} max={maxDayCount} color="blue" />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Peak Hours" subtitle="Most popular start times">
          <div className="space-y-3">
            {o.peakHours.map((h) => (
              <HorizontalBar key={h.hour} label={h.hour} value={h.count} max={maxHourCount} color="green" />
            ))}
            {o.peakHours.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No timing data yet.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Cancellation reasons */}
      {o.cancellationReasons.length > 0 && (
        <SectionCard title="Cancellation Reasons" subtitle="Why bookings are being cancelled">
          <div className="space-y-3">
            {o.cancellationReasons.map((r) => (
              <div key={r.reason} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{r.reason}</span>
                <span className="text-sm font-medium text-gray-900">{r.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Quality Tab ──────────────────────────────────────────

function QualityTab({ data }: { data: AnalyticsData }) {
  const q = data.qualityMetrics;
  const maxRatingCount = Math.max(...q.ratingDistribution.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Avg Rating" value={`${q.avgRating.toFixed(1)}/5`} sub={`${q.totalReviews} reviews`} color="amber" />
        <StatCard label="Thoroughness" value={q.avgThoroughness > 0 ? `${q.avgThoroughness.toFixed(1)}/5` : 'N/A'} color="green" />
        <StatCard label="Punctuality" value={q.avgPunctuality > 0 ? `${q.avgPunctuality.toFixed(1)}/5` : 'N/A'} color="blue" />
        <StatCard label="Communication" value={q.avgCommunication > 0 ? `${q.avgCommunication.toFixed(1)}/5` : 'N/A'} color="purple" />
        <StatCard label="Dispute Rate" value={`${q.disputeRate}%`} color={q.disputeRate <= 2 ? 'green' : q.disputeRate <= 5 ? 'amber' : 'red'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Rating Distribution" subtitle="How customers are rating your team">
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((stars) => {
              const item = q.ratingDistribution.find((r) => r.stars === stars);
              const count = item?.count || 0;
              return (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-12 text-right">{stars} star</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${stars >= 4 ? 'bg-green-500' : stars === 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8">{count}</span>
                </div>
              );
            })}
          </div>

          {q.totalReviews > 0 && (
            <div className="mt-6 p-4 bg-amber-50 rounded-lg">
              <p className="text-sm font-medium text-amber-700">Rating insight</p>
              <p className="text-xs text-amber-600 mt-1">
                {q.avgRating >= 4.5
                  ? 'Excellent quality. Your team is consistently delivering great service.'
                  : q.avgRating >= 4.0
                    ? 'Good quality overall. Focus on the sub-4-star reviews to find improvement areas.'
                    : 'Quality needs attention. Review individual team member ratings and common complaint categories.'}
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Complaints" subtitle={`${q.complaintsTotal} total complaints`}>
          {q.complaintsByCategory.length > 0 ? (
            <div className="space-y-3">
              {q.complaintsByCategory.map((c) => (
                <div key={c.category} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700 capitalize">{c.category}</span>
                  <span className="text-sm font-medium text-gray-900">{c.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-green-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500">No complaints recorded.</p>
            </div>
          )}

          {q.disputeRate > 0 && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-700">Dispute alert</p>
              <p className="text-xs text-red-600 mt-1">
                {q.disputeRate}% dispute rate.
                {q.disputeRate > 5
                  ? ' This is high - investigate recurring issues and address quality gaps.'
                  : ' Keeping this below 5% is healthy.'}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
