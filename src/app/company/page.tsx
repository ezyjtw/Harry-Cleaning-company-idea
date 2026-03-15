'use client';

import { useState } from 'react';

interface RecentBooking {
  id: string;
  customer: string;
  assignedTo: string;
  service: string;
  date: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
}

const mockStats = [
  { label: 'Total Bookings', value: '342', change: '+18 this week', color: 'blue' },
  {
    label: 'Revenue (MTD)',
    value: '\u00a38,450',
    change: '+14.2% from last month',
    color: 'green',
  },
  { label: 'Team Size', value: '12', change: '2 pending approval', color: 'purple' },
  { label: 'Avg Rating', value: '4.8', change: 'Based on 289 reviews', color: 'yellow' },
  { label: 'Completion Rate', value: '96%', change: '+2% from last month', color: 'teal' },
];

const mockRecentBookings: RecentBooking[] = [
  {
    id: 'B-3001',
    customer: 'Emma Wilson',
    assignedTo: 'Sarah Chen',
    service: 'Regular Clean',
    date: '2026-03-15',
    amount: 65,
    status: 'confirmed',
  },
  {
    id: 'B-3002',
    customer: 'James Taylor',
    assignedTo: 'Maria Santos',
    service: 'Deep Clean',
    date: '2026-03-15',
    amount: 120,
    status: 'in-progress',
  },
  {
    id: 'B-3003',
    customer: 'Olivia Brown',
    assignedTo: 'Unassigned',
    service: 'End of Tenancy',
    date: '2026-03-16',
    amount: 180,
    status: 'pending',
  },
  {
    id: 'B-3004',
    customer: 'Liam Johnson',
    assignedTo: 'Ewa Kowalski',
    service: 'Regular Clean',
    date: '2026-03-16',
    amount: 55,
    status: 'confirmed',
  },
  {
    id: 'B-3005',
    customer: 'Sophie Davis',
    assignedTo: 'Fatima Al-Rashid',
    service: 'AirBnB Turnover',
    date: '2026-03-17',
    amount: 90,
    status: 'pending',
  },
];

const mockTopPerformers = [
  { name: 'Sarah Chen', jobs: 48, rating: 4.9, revenue: '\u00a33,120' },
  { name: 'Maria Santos', jobs: 42, rating: 4.8, revenue: '\u00a32,890' },
  { name: 'Ewa Kowalski', jobs: 39, rating: 4.7, revenue: '\u00a32,640' },
];

export default function CompanyDashboard() {
  const [_refreshKey] = useState(0);

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
        <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back, Sparkle Co. Here is your business overview.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {mockStats.map((stat) => (
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
                {mockRecentBookings.map((booking) => (
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
                        {booking.status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Revenue Chart Placeholder */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue This Week</h2>
            <div className="h-40 flex items-end gap-2">
              {[50, 75, 60, 90, 70, 85, 0].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-green-500 rounded-t-md transition-all"
                    style={{ height: `${h}%`, minHeight: h > 0 ? '8px' : '0' }}
                  />
                  <span className="text-xs text-gray-400">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-2xl font-bold text-gray-900">&pound;8,450</p>
              <p className="text-sm text-gray-500">Month to date</p>
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
              {mockTopPerformers.map((performer, index) => (
                <div key={performer.name} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{performer.name}</p>
                      <p className="text-xs text-gray-400">
                        {performer.jobs} jobs &middot; {performer.rating} rating
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{performer.revenue}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
