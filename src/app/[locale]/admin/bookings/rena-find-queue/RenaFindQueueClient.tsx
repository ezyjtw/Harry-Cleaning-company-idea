'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface QueueBooking {
  id: string;
  shortId: string;
  customer: string;
  primaryCleaner: string;
  primaryRating: number;
  ratingFloor: number;
  serviceType: string;
  date: string;
  time: string;
  postcode: string;
  earnings: number;
}

export default function RenaFindQueueClient({ bookings }: { bookings: QueueBooking[] }) {
  const [rebroadcasting, setRebroadcasting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [items, setItems] = useState(bookings);

  async function handleRebroadcast(bookingId: string, noFloor: boolean) {
    setRebroadcasting(bookingId);
    setResults((prev) => {
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/rena-find-rebroadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noFloor ? {} : undefined),
      });
      const data = await res.json();
      if (res.ok) {
        setResults((prev) => ({
          ...prev,
          [bookingId]: {
            ok: true,
            message: `Rebroadcast to ${data.candidateCount} cleaners — expires ${new Date(data.expiresAt).toLocaleString('en-GB')}`,
          },
        }));
        setItems((prev) => prev.filter((b) => b.id !== bookingId));
      } else {
        setResults((prev) => ({
          ...prev,
          [bookingId]: { ok: false, message: data.error || `HTTP ${res.status}` },
        }));
      }
    } catch {
      setResults((prev) => ({
        ...prev,
        [bookingId]: { ok: false, message: 'Network error' },
      }));
    } finally {
      setRebroadcasting(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-500 mt-6">
        No bookings awaiting Rena-find decisions.
        {Object.entries(results).map(([id, r]) => (
          <div
            key={id}
            className={`mt-2 p-2 rounded text-sm ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
          >
            {r.message}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((b) => (
        <div key={b.id} className="border rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono font-medium">{b.shortId}</span>
                <span className="text-gray-400">·</span>
                <span>{b.serviceType}</span>
                <span className="text-gray-400">·</span>
                <span>
                  {b.date} {b.time}
                </span>
                <span className="text-gray-400">·</span>
                <span>{b.postcode}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Customer: {b.customer} · Primary: {b.primaryCleaner} ({b.primaryRating.toFixed(2)})
                · Floor: {b.ratingFloor.toFixed(2)} · Earnings: £{b.earnings.toFixed(2)}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/admin/bookings/${b.id}`}
                className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                View / Reassign / Refund
              </Link>
              <button
                onClick={() => handleRebroadcast(b.id, true)}
                disabled={rebroadcasting === b.id}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {rebroadcasting === b.id ? 'Broadcasting...' : 'Rebroadcast (no floor)'}
              </button>
            </div>
          </div>
          {results[b.id] && (
            <div
              className={`mt-2 p-2 rounded text-sm ${results[b.id].ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {results[b.id].message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
