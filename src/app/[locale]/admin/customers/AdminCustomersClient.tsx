'use client';

import { useState } from 'react';

import type { CustomerRow } from './page';

const ITEMS_PER_PAGE = 8;

export default function AdminCustomersClient({
  customers,
  total,
}: {
  customers: CustomerRow[];
  total: number;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusStyles: Record<string, string> = {
    active: 'bg-trust/10 text-trust',
    suspended: 'bg-danger/10 text-danger',
    inactive: 'bg-page text-ink-2',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customers</h1>
          <p className="text-ink-3 mt-1">{total} total customers</p>
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-4 py-2.5 rounded-lg border border-line text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden md:table-cell">
                  Join Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Bookings
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden sm:table-cell">
                  Total Spent
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginated.map((customer) => (
                <tr key={customer.id} className="hover:bg-page transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-ink">{customer.name}</p>
                    <p className="text-xs text-ink-3">{customer.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2 hidden md:table-cell">
                    {customer.joinDate}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink font-medium">
                    {customer.bookingsCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink hidden sm:table-cell">
                    &pound;
                    {customer.totalSpent.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[customer.status]}`}
                    >
                      {customer.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between">
            <p className="text-sm text-ink-3">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-line text-ink-2 hover:bg-page disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-line text-ink-2 hover:bg-page disabled:opacity-50 disabled:cursor-not-allowed"
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
