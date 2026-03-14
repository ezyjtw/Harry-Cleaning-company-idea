"use client";

import { useState } from "react";

interface AdminBooking {
  id: string;
  customer: string;
  cleaner: string;
  serviceType: string;
  date: string;
  time: string;
  amount: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "disputed";
}

const mockBookings: AdminBooking[] = [
  { id: "B-2001", customer: "Emma Wilson", cleaner: "Sarah Chen", serviceType: "Regular Clean", date: "2026-03-14", time: "09:00", amount: 65, status: "confirmed" },
  { id: "B-2002", customer: "James Taylor", cleaner: "Maria Santos", serviceType: "Deep Clean", date: "2026-03-14", time: "14:00", amount: 120, status: "in-progress" },
  { id: "B-2003", customer: "Olivia Brown", cleaner: "Sarah Chen", serviceType: "End of Tenancy", date: "2026-03-13", time: "10:00", amount: 180, status: "completed" },
  { id: "B-2004", customer: "Liam Johnson", cleaner: "Ewa Kowalski", serviceType: "Regular Clean", date: "2026-03-13", time: "08:30", amount: 55, status: "confirmed" },
  { id: "B-2005", customer: "Sophie Davis", cleaner: "Fatima Al-Rashid", serviceType: "AirBnB Turnover", date: "2026-03-13", time: "11:00", amount: 90, status: "completed" },
  { id: "B-2006", customer: "Daniel Lee", cleaner: "Sarah Chen", serviceType: "Deep Clean", date: "2026-03-12", time: "09:00", amount: 140, status: "disputed" },
  { id: "B-2007", customer: "Mia Clark", cleaner: "Maria Santos", serviceType: "Regular Clean", date: "2026-03-12", time: "14:00", amount: 60, status: "cancelled" },
  { id: "B-2008", customer: "Noah White", cleaner: "Ewa Kowalski", serviceType: "End of Tenancy", date: "2026-03-12", time: "10:00", amount: 200, status: "completed" },
  { id: "B-2009", customer: "Ava Martin", cleaner: "Fatima Al-Rashid", serviceType: "Regular Clean", date: "2026-03-11", time: "09:00", amount: 65, status: "completed" },
  { id: "B-2010", customer: "Ethan Harris", cleaner: "Sarah Chen", serviceType: "Office Clean", date: "2026-03-11", time: "08:00", amount: 150, status: "completed" },
  { id: "B-2011", customer: "Charlotte Evans", cleaner: "Olga Petrov", serviceType: "Regular Clean", date: "2026-03-15", time: "10:00", amount: 60, status: "pending" },
  { id: "B-2012", customer: "Michael O'Brien", cleaner: "Maria Santos", serviceType: "Deep Clean", date: "2026-03-15", time: "14:00", amount: 130, status: "pending" },
];

const ITEMS_PER_PAGE = 8;

export default function AdminBookingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = mockBookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesService = serviceFilter === "all" || b.serviceType === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusStyles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    "in-progress": "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    disputed: "bg-purple-100 text-purple-700",
  };

  const serviceTypes = Array.from(new Set(mockBookings.map((b) => b.serviceType)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 mt-1">{mockBookings.length} total bookings</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID or customer name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="disputed">Disputed</option>
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Services</option>
          {serviceTypes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Booking</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Cleaner</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Service</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Date/Time</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{booking.customer}</p>
                    <p className="text-xs text-gray-400 font-mono">{booking.id}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{booking.cleaner}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{booking.serviceType}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                    {booking.date} {booking.time}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">£{booking.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}>
                      {booking.status.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">Details</button>
                      {(booking.status === "confirmed" || booking.status === "pending") && (
                        <>
                          <button className="text-sm text-purple-600 hover:text-purple-800 font-medium">Reassign</button>
                          <button className="text-sm text-red-600 hover:text-red-800 font-medium">Cancel</button>
                        </>
                      )}
                      {booking.status === "completed" && (
                        <button className="text-sm text-orange-600 hover:text-orange-800 font-medium">Refund</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
