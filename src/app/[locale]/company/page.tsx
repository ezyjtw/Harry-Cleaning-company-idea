'use client';

import { useState, useEffect } from 'react';

import { useCompany } from './_context/CompanyContext';

interface DashboardData {
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  activeTeamMembers: number;
  totalTeamMembers: number;
}

interface RecentBooking {
  id: string;
  customer: string;
  assignedTo: string;
  service: string;
  date: string;
  amount: number;
  status: string;
}

interface TopPerformer {
  name: string;
  completedJobs: number;
  rating: number;
}

export default function CompanyDashboard() {
  const { company } = useCompany();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;

    Promise.all([
      fetch(`/api/companies/${company.id}/dashboard`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/bookings?limit=5`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/analytics`).then((r) => r.json()),
    ])
      .then(([dashData, bookingsData, analyticsData]) => {
        setDashboard(dashData);
        setRecentBookings(
          (bookingsData.bookings || []).map((b: Record<string, unknown>) => ({
            id: (b.id as string)?.substring(0, 8).toUpperCase(),
            customer:
              (b.client as Record<string, unknown>)?.name || (b.guestName as string) || 'Guest',
            assignedTo: (b.cleaner as Record<string, unknown>)?.name || 'Unassigned',
            service: b.serviceType || 'Cleaning',
            date: typeof b.date === 'string' ? b.date.split('T')[0] : '',
            amount: Number(b.totalPrice || 0),
            status: ((b.status as string) || '').toLowerCase().replace('_', '-'),
          }))
        );
        setTopPerformers(
          (analyticsData.topPerformers || []).map((p: Record<string, unknown>) => ({
            name: p.name || 'Unknown',
            completedJobs: Number(p.completedJobs || 0),
            rating: Number(p.rating || 0),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const completionRate =
    dashboard && dashboard.totalBookings > 0
      ? Math.round((dashboard.completedBookings / dashboard.totalBookings) * 100)
      : 0;

  const stats = [
    {
      label: 'Total Bookings',
      value: String(dashboard?.totalBookings || 0),
      change: `${dashboard?.pendingBookings || 0} pending`,
      color: 'blue',
    },
    {
      label: 'Revenue',
      value: `\u00a3${(dashboard?.totalRevenue || 0).toLocaleString()}`,
      change: `${dashboard?.completedBookings || 0} completed`,
      color: 'green',
    },
    {
      label: 'Team Size',
      value: String(dashboard?.totalTeamMembers || 0),
      change: `${dashboard?.activeTeamMembers || 0} active`,
      color: 'purple',
    },
    {
      label: 'Avg Rating',
      value: (dashboard?.averageRating || 0).toFixed(1),
      change: `Based on ${dashboard?.totalReviews || 0} reviews`,
      color: 'yellow',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      change: `${dashboard?.cancelledBookings || 0} cancelled`,
      color: 'teal',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const statusStyles: Record<string, string> = {
    confirmed: 'bg-blue-100 text-blue-700',
    'in-progress': 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partner Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here is your business overview.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl border p-5 ${colorMap[stat.color]}`}>
            <p className="text-sm font-medium opacity-80">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
            <p className="text-xs mt-2 opacity-70">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <a
              href="/company/bookings"
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              View All
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Assigned To
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{booking.customer}</p>
                        <p className="text-xs text-gray-400">
                          {booking.id} &middot; {booking.service}
                        </p>
                      </td>
                      <td className="px-6 py-3 hidden sm:table-cell">
                        <span
                          className={`text-sm ${booking.assignedTo === 'Unassigned' ? 'text-red-500 font-medium' : 'text-gray-600'}`}
                        >
                          {booking.assignedTo}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        &pound;{booking.amount}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status] || ''}`}
                        >
                          {booking.status
                            .replace('-', ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Revenue summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Summary</h2>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                &pound;{(dashboard?.totalRevenue || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Total revenue</p>
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Top Performers</h2>
              <a
                href="/company/team"
                className="text-sm text-green-600 hover:text-green-800 font-medium"
              >
                View Team
              </a>
            </div>
            <div className="divide-y divide-gray-100">
              {topPerformers.length === 0 ? (
                <div className="px-6 py-6 text-center text-sm text-gray-400">
                  No team performance data yet.
                </div>
              ) : (
                topPerformers.slice(0, 3).map((performer, index) => (
                  <div key={performer.name} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{performer.name}</p>
                        <p className="text-xs text-gray-400">
                          {performer.completedJobs} jobs &middot; {performer.rating.toFixed(1)}{' '}
                          rating
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
