'use client';

// TEMPORARY — manual trigger for releaseBookingFunds.
// Replace with A6 scheduler. Remove this page when A6 ships.

import { useState } from 'react';

interface ReleaseResult {
  status: string;
  transferId?: string;
  reason?: string;
}

export default function AdminReleaseFundsPage() {
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReleaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRelease() {
    if (!bookingId.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/release-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    RELEASED: 'text-green-700 bg-green-50',
    ALREADY_RELEASED: 'text-blue-700 bg-blue-50',
    FAILED: 'text-red-700 bg-red-50',
    UNKNOWN: 'text-amber-700 bg-amber-50',
    SKIPPED: 'text-gray-700 bg-gray-50',
  };

  return (
    <div className="max-w-xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Release Booking Funds</h1>
        <p className="text-sm text-gray-500 mt-1">
          TEMPORARY — triggers releaseBookingFunds for a single booking. Will be replaced by A6
          scheduler.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="Paste booking ID"
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
        />
        <button
          onClick={handleRelease}
          disabled={loading || !bookingId.trim()}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
        >
          {loading ? 'Releasing...' : 'Release'}
        </button>
      </div>

      {error && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>}

      {result && (
        <div className="mt-4 space-y-2">
          <div
            className={`inline-block px-3 py-1 text-sm font-medium rounded ${statusColor[result.status] || 'text-gray-700 bg-gray-50'}`}
          >
            {result.status}
          </div>
          {result.transferId && (
            <p className="text-sm text-gray-600">
              Transfer ID: <code className="font-mono">{result.transferId}</code>
            </p>
          )}
          {result.reason && <p className="text-sm text-gray-600">Reason: {result.reason}</p>}
        </div>
      )}
    </div>
  );
}
