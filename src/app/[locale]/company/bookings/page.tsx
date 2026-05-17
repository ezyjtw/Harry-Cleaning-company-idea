'use client';

import { useState, useEffect, useCallback } from 'react';

import { useCompany } from '../_context/CompanyContext';

interface Booking {
  id: string;
  fullId: string;
  customer: string;
  address: string;
  service: string;
  date: string;
  time: string;
  amount: number;
  status: string;
  assignedTo: string;
  cleanerId: string;
}

interface TeamMember {
  userId: string;
  name: string;
}

export default function BookingsPage() {
  const { company } = useCompany();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(() => {
    if (!company?.id) return;

    const params = new URLSearchParams({ limit: '50' });
    if (statusFilter !== 'all') params.set('status', statusFilter.toUpperCase().replace('-', '_'));

    Promise.all([
      fetch(`/api/companies/${company.id}/bookings?${params}`).then((r) => r.json()),
      fetch(`/api/companies/${company.id}/team`).then((r) => r.json()),
    ])
      .then(([bookingsData, teamData]) => {
        setBookings(
          (bookingsData.bookings || []).map((b: Record<string, unknown>) => {
            const addr = b.address as Record<string, unknown> | null;
            return {
              id: (b.id as string)?.substring(0, 8).toUpperCase(),
              fullId: b.id,
              customer:
                (b.client as Record<string, unknown>)?.name || (b.guestName as string) || 'Guest',
              address: addr ? `${addr.line1}, ${addr.postcode}` : '',
              service: b.serviceType || 'Cleaning',
              date: typeof b.date === 'string' ? b.date.split('T')[0] : '',
              time: b.startTime || '',
              amount: Number(b.totalPrice || 0),
              status: ((b.status as string) || '').toLowerCase().replace('_', '-'),
              assignedTo: (b.cleaner as Record<string, unknown>)?.name || '',
              cleanerId: (b.cleaner as Record<string, unknown>)?.id || '',
            };
          })
        );
        setTeamMembers(
          (teamData.members || []).map((m: Record<string, unknown>) => ({
            userId: m.userId,
            name: (m.user as Record<string, unknown>)?.name || 'Unknown',
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async (bookingFullId: string, cleanerId: string) => {
    if (!company?.id) return;
    try {
      // Use the booking assignment endpoint
      const res = await fetch(`/api/companies/${company.id}/bookings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingFullId, cleanerId }),
      });
      if (res.ok) {
        const assigned = teamMembers.find((m) => m.userId === cleanerId);
        setBookings((prev) =>
          prev.map((b) =>
            b.fullId === bookingFullId ? { ...b, assignedTo: assigned?.name || '', cleanerId } : b
          )
        );
      }
    } catch {}
  };

  const filteredBookings = bookings.filter((b) => {
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
    accepted: 'bg-blue-100 text-blue-700',
  };

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 mt-1">Manage and assign bookings to your team members.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
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
                <tr key={booking.fullId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{booking.customer}</p>
                    <p className="text-xs text-gray-400">
                      {booking.id} &middot; {booking.service}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                    {booking.address || 'N/A'}
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
                        value={booking.cleanerId}
                        onChange={(e) => handleAssign(booking.fullId, e.target.value)}
                        className={`text-sm rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          booking.cleanerId
                            ? 'border-gray-300 text-gray-700'
                            : 'border-red-300 text-red-500'
                        }`}
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((tm) => (
                          <option key={tm.userId} value={tm.userId}>
                            {tm.name}
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
