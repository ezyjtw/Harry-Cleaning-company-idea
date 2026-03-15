'use client';

import { useState } from 'react';

const mockMetrics = [
  {
    label: 'Total Revenue',
    value: '\u00a38,450',
    change: '+14.2%',
    color: 'green',
    period: 'This month',
  },
  { label: 'Total Bookings', value: '342', change: '+8.5%', color: 'blue', period: 'This month' },
  {
    label: 'Avg Job Value',
    value: '\u00a374.50',
    change: '+3.1%',
    color: 'purple',
    period: 'This month',
  },
  {
    label: 'Customer Retention',
    value: '78%',
    change: '+5%',
    color: 'teal',
    period: 'vs last month',
  },
];

const monthlyRevenue = [
  { month: 'Oct', value: 5200 },
  { month: 'Nov', value: 6100 },
  { month: 'Dec', value: 7800 },
  { month: 'Jan', value: 6400 },
  { month: 'Feb', value: 7200 },
  { month: 'Mar', value: 8450 },
];

const serviceBreakdown = [
  { service: 'Regular Clean', count: 156, revenue: 9360, percentage: 45 },
  { service: 'Deep Clean', count: 78, revenue: 9360, percentage: 23 },
  { service: 'End of Tenancy', count: 45, revenue: 8100, percentage: 13 },
  { service: 'AirBnB Turnover', count: 38, revenue: 3420, percentage: 11 },
  { service: 'Office Clean', count: 25, revenue: 3750, percentage: 8 },
];

const teamUtilization = [
  { name: 'Sarah Chen', utilization: 92, jobs: 48, hours: 184 },
  { name: 'Maria Santos', utilization: 87, jobs: 42, hours: 168 },
  { name: 'Ana Popescu', utilization: 84, jobs: 40, hours: 160 },
  { name: 'Ewa Kowalski', utilization: 81, jobs: 39, hours: 156 },
  { name: 'Fatima Al-Rashid', utilization: 76, jobs: 35, hours: 140 },
  { name: 'Li Wei', utilization: 68, jobs: 28, hours: 112 },
];

const performanceMetrics = [
  { label: 'On-Time Rate', value: '94%', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  {
    label: 'Avg Rating',
    value: '4.8/5',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  },
  {
    label: 'Repeat Customers',
    value: '64%',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  { label: 'Completion Rate', value: '96%', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export default function AnalyticsPage() {
  const [_period] = useState('month');

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.value));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Performance metrics and business insights.</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mockMetrics.map((metric) => (
          <div key={metric.label} className={`rounded-xl border p-5 ${colorMap[metric.color]}`}>
            <p className="text-sm font-medium opacity-80">{metric.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold">{metric.value}</p>
              <span className="text-sm font-medium opacity-70">{metric.change}</span>
            </div>
            <p className="text-xs mt-2 opacity-60">{metric.period}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Monthly Revenue</h2>
          <div className="h-52 flex items-end gap-3">
            {monthlyRevenue.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-gray-600">
                  &pound;{(m.value / 1000).toFixed(1)}k
                </span>
                <div
                  className="w-full bg-green-500 rounded-t-md transition-all hover:bg-green-600"
                  style={{ height: `${(m.value / maxRevenue) * 100}%`, minHeight: '8px' }}
                />
                <span className="text-xs text-gray-500">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Service Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Service Breakdown</h2>
          <div className="space-y-4">
            {serviceBreakdown.map((service) => (
              <div key={service.service}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{service.service}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{service.count} bookings</span>
                    <span className="text-sm font-semibold text-gray-900">
                      &pound;{service.revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${service.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {performanceMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white rounded-xl border border-gray-200 p-5 text-center"
          >
            <svg
              className="w-8 h-8 text-green-600 mx-auto mb-2"
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
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-sm text-gray-500 mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Team Utilization */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Team Utilization</h2>
          <p className="text-sm text-gray-500 mt-0.5">Current month performance by team member</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Member
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilization
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Jobs Completed
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Hours Worked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teamUtilization.map((member) => (
                <tr key={member.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-semibold">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[120px] bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            member.utilization >= 85
                              ? 'bg-green-500'
                              : member.utilization >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${member.utilization}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {member.utilization}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                    {member.jobs}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                    {member.hours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
