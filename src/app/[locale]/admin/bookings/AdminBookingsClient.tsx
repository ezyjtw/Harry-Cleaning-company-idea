'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { serviceLabelFromSlug } from '@/lib/constants/services';

import type { BookingRow } from './page';

const ITEMS_PER_PAGE = 8;

function RefundModal({ booking, onClose }: { booking: BookingRow; onClose: () => void }) {
  const refundable = +(booking.amount - booking.refundedAmount).toFixed(2);
  const [amount, setAmount] = useState(refundable.toString());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.fullId,
          amount: parseFloat(amount),
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const label = data.status === 'SKIPPED' ? 'Skipped' : 'Failed';
        setResult({ ok: false, message: `${label}: ${data.error}` });
      } else {
        const refunded = data.amountRefunded?.toFixed(2) ?? amount;
        setResult({ ok: true, message: `Refund of £${refunded} succeeded` });
      }
    } catch {
      setResult({ ok: false, message: 'Network error — check console' });
    } finally {
      setSubmitting(false);
    }
  }, [booking.fullId, amount, reason]);

  const parsedAmount = parseFloat(amount);
  const valid = parsedAmount > 0 && parsedAmount <= refundable + 0.01 && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-ink mb-1">Refund Booking</h3>
        <p className="text-sm text-ink-3 mb-4">
          {booking.customer} — {booking.id} — £{booking.amount.toFixed(2)} paid
          {booking.refundedAmount > 0 && `, £${booking.refundedAmount.toFixed(2)} already refunded`}
        </p>

        {result && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-trust/10 text-trust' : 'bg-danger/10 text-danger'}`}
          >
            {result.message}
          </div>
        )}

        {!result?.ok ? (
          <>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Amount (max £{refundable.toFixed(2)})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={refundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <label className="block text-sm font-medium text-ink-2 mb-1">Reason</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="Why is this refund being issued?"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-ink-2 rounded-lg border border-line hover:bg-page"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!valid || submitting}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-danger hover:bg-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Processing…'
                  : `Refund £${parsedAmount > 0 ? parsedAmount.toFixed(2) : '0.00'}`}
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-ink-2 rounded-lg border border-line hover:bg-page"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminBookingsClient({
  bookings,
  total,
  serviceTypes,
}: {
  bookings: BookingRow[];
  total: number;
  serviceTypes: string[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<BookingRow | null>(null);

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesService = serviceFilter === 'all' || b.serviceType === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const statusStyles: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    awaiting_cleaner: 'bg-warning/10 text-warning',
    confirmed: 'bg-primary-soft text-primary',
    'in-progress': 'bg-orange-100 text-orange-700',
    completed: 'bg-trust/10 text-trust',
    cancelled: 'bg-danger/10 text-danger',
    disputed: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bookings</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-ink-3">{total} total bookings</p>
            <Link
              href="/admin/bookings/stuck-money"
              className="text-sm text-danger hover:underline font-medium"
            >
              Stuck money &rarr;
            </Link>
          </div>
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
            placeholder="Search by ID or customer name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-4 py-2.5 rounded-lg border border-line text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="awaiting_cleaner">Awaiting Cleaner</option>
          <option value="confirmed">Confirmed</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="disputed">Disputed</option>
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Services</option>
          {serviceTypes.map((s) => (
            <option key={s} value={s}>
              {serviceLabelFromSlug(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Booking
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden md:table-cell">
                  Cleaner
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden lg:table-cell">
                  Service
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden sm:table-cell">
                  Date/Time
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginated.map((booking) => (
                <tr
                  key={booking.id}
                  className="hover:bg-page transition-colors cursor-pointer"
                  onClick={() => (window.location.href = `/admin/bookings/${booking.fullId}`)}
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/bookings/${booking.fullId}`}
                      className="text-sm font-medium text-ink hover:text-primary"
                    >
                      {booking.customer}
                    </Link>
                    <p className="text-xs text-ink-3 font-mono">{booking.id}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2 hidden md:table-cell">
                    {booking.cleaner}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2 hidden lg:table-cell">
                    {serviceLabelFromSlug(booking.serviceType)}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-2 hidden sm:table-cell">
                    {booking.date} {booking.time}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-ink">
                    &pound;{booking.amount}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status]}`}
                    >
                      {booking.status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {booking.amount - booking.refundedAmount > 0.01 && (
                      <button
                        onClick={() => setRefundTarget(booking)}
                        className="text-xs font-medium text-danger hover:text-danger"
                      >
                        Refund
                      </button>
                    )}
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

      {refundTarget && <RefundModal booking={refundTarget} onClose={() => setRefundTarget(null)} />}
    </div>
  );
}
