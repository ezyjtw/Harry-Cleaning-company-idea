'use client';

import { useState, useEffect } from 'react';

import { useCompany } from '../_context/CompanyContext';

interface PerformanceMetrics {
  completionRate: number;
  averageRating: number;
  totalRevenue: number;
  revenueThisMonth: number;
  bookingsThisMonth: number;
  cancellationRate: number;
  averageJobDuration: number;
  topPerformers: { userId: string; name: string | null; completedJobs: number; rating: number }[];
}

interface DashboardData {
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  activeTeamMembers: number;
  totalTeamMembers: number;
}

export default function AnalyticsPage() {
  const { company } = useCompany();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;

    Promise.all([
      fetch(`/api/companies/${company.id}/analytics`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/dashboard`).then((r) => r.json()),
    ])
      .then(([analyticsData, dashData]) => {
        setMetrics(analyticsData);
        setDashboard(dashData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  const topMetrics = [
    {
      label: 'Total Revenue',
      value: `\u00a3${(metrics?.totalRevenue || 0).toLocaleString()}`,
      change: `\u00a3${(metrics?.revenueThisMonth || 0).toLocaleString()} this month`,
      color: 'green',
    },
    {
      label: 'Total Bookings',
      value: String(dashboard?.totalBookings || 0),
      change: `${metrics?.bookingsThisMonth || 0} this month`,
      color: 'blue',
    },
    {
      label: 'Avg Job Duration',
      value: `${(metrics?.averageJobDuration || 0).toFixed(1)}h`,
      change: `${dashboard?.completedBookings || 0} completed`,
      color: 'purple',
    },
    {
      label: 'Cancellation Rate',
      value: `${(metrics?.cancellationRate || 0).toFixed(1)}%`,
      change: `${dashboard?.pendingBookings || 0} pending`,
      color: 'teal',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const performanceCards = [
    { label: 'Completion Rate', value: `${(metrics?.completionRate || 0).toFixed(0)}%`, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Avg Rating', value: `${(metrics?.averageRating || 0).toFixed(1)}/5`, icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { label: 'Total Reviews', value: String(dashboard?.totalReviews || 0), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { label: 'Team Members', value: `${dashboard?.activeTeamMembers || 0}/${dashboard?.totalTeamMembers || 0}`, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Performance metrics and business insights.</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {topMetrics.map((metric) => (
          <div key={metric.label} className={`rounded-xl border p-5 ${colorMap[metric.color]}`}>
            <p className="text-sm font-medium opacity-80">{metric.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold">{metric.value}</p>
            </div>
            <p className="text-xs mt-2 opacity-60">{metric.change}</p>
          </div>
        ))}
      </div>

      {/* Performance metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {performanceCards.map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <svg className="w-8 h-8 text-green-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={metric.icon} />
            </svg>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-sm text-gray-500 mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Top Performers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Team members ranked by completed jobs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Team Member</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Completed Jobs</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(metrics?.topPerformers || []).map((member, index) => (
                <tr key={member.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{member.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.completedJobs}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                    {member.rating > 0 ? member.rating.toFixed(1) : 'N/A'}
                  </td>
                </tr>
              ))}
              {(!metrics?.topPerformers || metrics.topPerformers.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                    No performance data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
