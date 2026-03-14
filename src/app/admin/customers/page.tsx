"use client";

import { useState } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  bookingsCount: number;
  totalSpent: number;
  status: "active" | "suspended" | "inactive";
}

const mockCustomers: Customer[] = [
  { id: "C-001", name: "Emma Wilson", email: "emma@email.com", joinDate: "2025-06-15", bookingsCount: 24, totalSpent: 1560, status: "active" },
  { id: "C-002", name: "James Taylor", email: "james@email.com", joinDate: "2025-08-22", bookingsCount: 12, totalSpent: 840, status: "active" },
  { id: "C-003", name: "Olivia Brown", email: "olivia@email.com", joinDate: "2025-09-10", bookingsCount: 8, totalSpent: 620, status: "active" },
  { id: "C-004", name: "Liam Johnson", email: "liam@email.com", joinDate: "2025-11-01", bookingsCount: 3, totalSpent: 180, status: "active" },
  { id: "C-005", name: "Sophie Davis", email: "sophie@email.com", joinDate: "2025-07-18", bookingsCount: 18, totalSpent: 1240, status: "active" },
  { id: "C-006", name: "Daniel Lee", email: "daniel@email.com", joinDate: "2025-10-05", bookingsCount: 6, totalSpent: 480, status: "suspended" },
  { id: "C-007", name: "Mia Clark", email: "mia@email.com", joinDate: "2026-01-12", bookingsCount: 2, totalSpent: 120, status: "active" },
  { id: "C-008", name: "Noah White", email: "noah@email.com", joinDate: "2025-12-20", bookingsCount: 5, totalSpent: 350, status: "active" },
  { id: "C-009", name: "Ava Martin", email: "ava@email.com", joinDate: "2026-02-01", bookingsCount: 1, totalSpent: 65, status: "inactive" },
  { id: "C-010", name: "Ethan Harris", email: "ethan@email.com", joinDate: "2025-05-30", bookingsCount: 30, totalSpent: 2100, status: "active" },
  { id: "C-011", name: "Charlotte Evans", email: "charlotte@email.com", joinDate: "2026-03-14", bookingsCount: 0, totalSpent: 0, status: "active" },
  { id: "C-012", name: "Michael O'Brien", email: "michael@email.com", joinDate: "2026-03-13", bookingsCount: 0, totalSpent: 0, status: "active" },
];

const ITEMS_PER_PAGE = 8;

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = mockCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusStyles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    suspended: "bg-red-100 text-red-700",
    inactive: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{mockCustomers.length} total customers</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Join Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Total Spent</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                    <p className="text-xs text-gray-400">{customer.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{customer.joinDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{customer.bookingsCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 hidden sm:table-cell">£{customer.totalSpent}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[customer.status]}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">View</button>
                      <button className="text-sm text-yellow-600 hover:text-yellow-800 font-medium">
                        {customer.status === "suspended" ? "Unsuspend" : "Suspend"}
                      </button>
                      <button className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
