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

interface PreviewData {
  candidateCount: number;
  candidates: { name: string; rating: number; distanceKm: number }[];
  belowFloorCount: number;
}

export default function RenaFindQueueClient({ bookings }: { bookings: QueueBooking[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [items, setItems] = useState(bookings);

  async function handlePreview(bookingId: string) {
    setLoading(bookingId);
    setResults((prev) => {
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/rena-find-rebroadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviews((prev) => ({ ...prev, [bookingId]: data }));
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
      setLoading(null);
    }
  }

  async function handleConfirmRebroadcast(bookingId: string) {
    setLoading(bookingId);

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/rena-find-rebroadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviews((prev) => {
          const next = { ...prev };
          delete next[bookingId];
          return next;
        });
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
      setLoading(null);
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
              {!previews[b.id] && (
                <button
                  onClick={() => handlePreview(b.id)}
                  disabled={loading === b.id}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === b.id ? 'Loading...' : 'Preview rebroadcast'}
                </button>
              )}
            </div>
          </div>
          {previews[b.id] && (
            <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
              <div className="font-medium text-blue-900">
                Will offer to {previews[b.id].candidateCount} cleaner
                {previews[b.id].candidateCount !== 1 ? 's' : ''}:
              </div>
              <ul className="mt-1 space-y-0.5 text-blue-800">
                {previews[b.id].candidates.map((c, i) => (
                  <li key={i}>
                    {c.name} — rating {c.rating.toFixed(2)}
                    {c.distanceKm > 0 ? `, ${c.distanceKm.toFixed(1)}km away` : ''}
                  </li>
                ))}
              </ul>
              {previews[b.id].belowFloorCount > 0 && (
                <div className="mt-1 text-blue-600">
                  ({previews[b.id].belowFloorCount} below original floor excluded by rating filter)
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleConfirmRebroadcast(b.id)}
                  disabled={loading === b.id}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === b.id ? 'Broadcasting...' : 'Confirm & broadcast'}
                </button>
                <button
                  onClick={() =>
                    setPreviews((prev) => {
                      const next = { ...prev };
                      delete next[b.id];
                      return next;
                    })
                  }
                  className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
