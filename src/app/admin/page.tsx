'use client';

import { useState } from 'react';

interface RecentBooking {
  id: string;
  customer: string;
  cleaner: string;
  service: string;
  date: string;
  amount: number;
  status: string;
}

interface RecentSignup {
  id: string;
  name: string;
  type: 'customer' | 'cleaner';
  email: string;
  date: string;
}

const mockMetrics = [
  {
    label: 'Total Bookings',
    value: '1,247',
    change: '+8.2% from last month',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    color: 'blue',
  },
  {
    label: 'Active Cleaners',
    value: '89',
    change: '+5 this week',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'green',
  },
  {
    label: 'Revenue (MTD)',
    value: '£24,680',
    change: '+12.5% from last month',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'purple',
  },
  {
    label: 'Pending Disputes',
    value: '3',
    change: '2 urgent',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    color: 'red',
  },
];

const mockRecentBookings: RecentBooking[] = [
  {
    id: 'B-2001',
    customer: 'Emma Wilson',
    cleaner: 'Sarah Chen',
    service: 'Regular Clean',
    date: '2026-03-14',
    amount: 65,
    status: 'confirmed',
  },
  {
    id: 'B-2002',
    customer: 'James Taylor',
    cleaner: 'Maria Santos',
    service: 'Deep Clean',
    date: '2026-03-14',
    amount: 120,
    status: 'in-progress',
  },
  {
    id: 'B-2003',
    customer: 'Olivia Brown',
    cleaner: 'Sarah Chen',
    service: 'End of Tenancy',
    date: '2026-03-13',
    amount: 180,
    status: 'completed',
  },
  {
    id: 'B-2004',
    customer: 'Liam Johnson',
    cleaner: 'Ewa Kowalski',
    service: 'Regular Clean',
    date: '2026-03-13',
    amount: 55,
    status: 'confirmed',
  },
  {
    id: 'B-2005',
    customer: 'Sophie Davis',
    cleaner: 'Fatima Al-Rashid',
    service: 'AirBnB Turnover',
    date: '2026-03-13',
    amount: 90,
    status: 'completed',
  },
  {
    id: 'B-2006',
    customer: 'Daniel Lee',
    cleaner: 'Sarah Chen',
    service: 'Deep Clean',
    date: '2026-03-12',
    amount: 140,
    status: 'completed',
  },
  {
    id: 'B-2007',
    customer: 'Mia Clark',
    cleaner: 'Maria Santos',
    service: 'Regular Clean',
    date: '2026-03-12',
    amount: 60,
    status: 'cancelled',
  },
  {
    id: 'B-2008',
    customer: 'Noah White',
    cleaner: 'Ewa Kowalski',
    service: 'End of Tenancy',
    date: '2026-03-12',
    amount: 200,
    status: 'completed',
  },
  {
    id: 'B-2009',
    customer: 'Ava Martin',
    cleaner: 'Fatima Al-Rashid',
    service: 'Regular Clean',
    date: '2026-03-11',
    amount: 65,
    status: 'completed',
  },
  {
    id: 'B-2010',
    customer: 'Ethan Harris',
    cleaner: 'Sarah Chen',
    service: 'Office Clean',
    date: '2026-03-11',
    amount: 150,
    status: 'completed',
  },
];

const mockRecentSignups: RecentSignup[] = [
  {
    id: 'U-001',
    name: 'Charlotte Evans',
    type: 'customer',
    email: 'charlotte@email.com',
    date: '2026-03-14',
  },
  {
    id: 'U-002',
    name: 'Priya Sharma',
    type: 'cleaner',
    email: 'priya@email.com',
    date: '2026-03-14',
  },
  {
    id: 'U-003',
    name: "Michael O'Brien",
    type: 'customer',
    email: 'michael@email.com',
    date: '2026-03-13',
  },
  { id: 'U-004', name: 'Ana Popescu', type: 'cleaner', email: 'ana@email.com', date: '2026-03-13' },
  {
    id: 'U-005',
    name: 'David Kim',
    type: 'customer',
    email: 'david@email.com',
    date: '2026-03-12',
  },
];

export default function AdminDashboard() {
  const [_refreshKey] = useState(0);

  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' },
    red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' },
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
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform overview and key metrics</p>
        <a
          href="/admin/analytics"
          className="mt-2 inline-block rounded bg-ink px-4 py-2 font-jost text-sm text-cream hover:bg-ink/90"
        >
          Funnel Analytics
        </a>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mockMetrics.map((metric) => {
          const colors = colorMap[metric.color];
          return (
            <div
              key={metric.label}
              className={`rounded-xl border p-5 ${colors.bg} border-transparent`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${colors.text} opacity-80`}>{metric.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>{metric.value}</p>
                  <p className={`text-xs mt-2 ${colors.text} opacity-60`}>{metric.change}</p>
                </div>
                <svg
                  className={`w-8 h-8 ${colors.icon} opacity-50`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d={metric.icon}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent bookings table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <a
              href="/admin/bookings"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
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
                    Service
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
                        {booking.id} &middot; {booking.date}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {booking.service}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      £{booking.amount}
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
          {/* Revenue chart placeholder */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue (Last 7 Days)</h2>
            <div className="h-40 flex items-end gap-2">
              {[60, 85, 45, 90, 70, 95, 50].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-500 rounded-t-md"
                    style={{ height: `${h}%`, minHeight: '8px' }}
                  />
                  <span className="text-xs text-gray-400">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-2xl font-bold text-gray-900">£24,680</p>
              <p className="text-sm text-gray-500">Month to date</p>
            </div>
          </div>

          {/* Recent signups */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Signups</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {mockRecentSignups.map((signup) => (
                <div key={signup.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{signup.name}</p>
                    <p className="text-xs text-gray-400">{signup.email}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        signup.type === 'cleaner'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {signup.type === 'cleaner' ? 'Cleaner' : 'Customer'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{signup.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
