'use client';

import { useState } from 'react';

interface Booking {
  id: string;
  customer: string;
  address: string;
  service: string;
  date: string;
  time: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  assignedTo: string;
}

const teamMembers = [
  'Sarah Chen',
  'Maria Santos',
  'Ewa Kowalski',
  'Fatima Al-Rashid',
  'Li Wei',
  'Ana Popescu',
];

const initialBookings: Booking[] = [
  {
    id: 'B-3001',
    customer: 'Emma Wilson',
    address: '14 Baker St, W1U 3BW',
    service: 'Regular Clean',
    date: '2026-03-15',
    time: '09:00',
    amount: 65,
    status: 'confirmed',
    assignedTo: 'Sarah Chen',
  },
  {
    id: 'B-3002',
    customer: 'James Taylor',
    address: '8 Canary Wharf, E14 5AB',
    service: 'Deep Clean',
    date: '2026-03-15',
    time: '14:00',
    amount: 120,
    status: 'in-progress',
    assignedTo: 'Maria Santos',
  },
  {
    id: 'B-3003',
    customer: 'Olivia Brown',
    address: '22 Richmond Rd, TW9 2NA',
    service: 'End of Tenancy',
    date: '2026-03-16',
    time: '10:00',
    amount: 180,
    status: 'pending',
    assignedTo: '',
  },
  {
    id: 'B-3004',
    customer: 'Liam Johnson',
    address: '5 Kings Road, SW3 4ND',
    service: 'Regular Clean',
    date: '2026-03-16',
    time: '12:00',
    amount: 55,
    status: 'confirmed',
    assignedTo: 'Ewa Kowalski',
  },
  {
    id: 'B-3005',
    customer: 'Sophie Davis',
    address: '31 Notting Hill Gate, W11 3JQ',
    service: 'AirBnB Turnover',
    date: '2026-03-17',
    time: '11:00',
    amount: 90,
    status: 'pending',
    assignedTo: '',
  },
  {
    id: 'B-3006',
    customer: 'Daniel Lee',
    address: '17 Camden High St, NW1 7JE',
    service: 'Deep Clean',
    date: '2026-03-17',
    time: '09:00',
    amount: 140,
    status: 'pending',
    assignedTo: 'Fatima Al-Rashid',
  },
  {
    id: 'B-3007',
    customer: 'Mia Clark',
    address: '42 Greenwich Park, SE10 8QY',
    service: 'Regular Clean',
    date: '2026-03-18',
    time: '10:00',
    amount: 60,
    status: 'confirmed',
    assignedTo: 'Sarah Chen',
  },
  {
    id: 'B-3008',
    customer: 'Noah White',
    address: '9 Brixton Rd, SW9 6DE',
    service: 'End of Tenancy',
    date: '2026-03-14',
    time: '09:00',
    amount: 200,
    status: 'completed',
    assignedTo: 'Ewa Kowalski',
  },
  {
    id: 'B-3009',
    customer: 'Ava Martin',
    address: '28 Kensington High St, W8 4PT',
    service: 'Regular Clean',
    date: '2026-03-13',
    time: '14:00',
    amount: 65,
    status: 'completed',
    assignedTo: 'Maria Santos',
  },
  {
    id: 'B-3010',
    customer: 'Ethan Harris',
    address: '15 Shoreditch High St, E1 6JE',
    service: 'Office Clean',
    date: '2026-03-13',
    time: '08:00',
    amount: 150,
    status: 'cancelled',
    assignedTo: 'Li Wei',
  },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleAssign = (bookingId: string, cleaner: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, assignedTo: cleaner } : b))
    );
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    return true;
  });

  const statusStyles: Record<string, string> = {
    confirmed: 'bg-blue-100 text-blue-700',
    'in-progress': 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 mt-1">Manage and assign bookings to your team members.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'confirmed', label: 'Confirmed' },
              { key: 'in-progress', label: 'In Progress' },
              { key: 'completed', label: 'Completed' },
              { key: 'cancelled', label: 'Cancelled' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === key
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
                {key !== 'all' && statusCounts[key]
                  ? ` (${statusCounts[key]})`
                  : key === 'all'
                    ? ` (${bookings.length})`
                    : ''}
              </button>
            ))}
          </div>

          {/* Date filters */}
          <div className="flex gap-3 sm:ml-auto items-center">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700 mt-4"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bookings list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Address
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Date/Time
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{booking.customer}</p>
                    <p className="text-xs text-gray-400">
                      {booking.id} &middot; {booking.service}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                    {booking.address}
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <p className="text-sm text-gray-600">{booking.date}</p>
                    <p className="text-xs text-gray-400">{booking.time}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    &pound;{booking.amount}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status] || ''}`}
                    >
                      {booking.status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {booking.status !== 'completed' && booking.status !== 'cancelled' ? (
                      <select
                        value={booking.assignedTo}
                        onChange={(e) => handleAssign(booking.id, e.target.value)}
                        className={`text-sm rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          booking.assignedTo
                            ? 'border-gray-300 text-gray-700'
                            : 'border-red-300 text-red-500'
                        }`}
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-500">{booking.assignedTo || 'N/A'}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    No bookings match the selected filters.
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
