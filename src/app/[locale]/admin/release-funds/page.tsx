'use client';

// Admin override — manual release for stuck, FAILED, or UNKNOWN transfers.
// The scheduler handles normal auto-release; this page is the permanent
// admin retry/override dashboard.

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
    RELEASED: 'text-trust bg-trust/10',
    ALREADY_RELEASED: 'text-primary bg-primary-soft',
    FAILED: 'text-danger bg-danger/10',
    UNKNOWN: 'text-warning bg-warning/10',
    SKIPPED: 'text-ink-2 bg-page',
  };

  return (
    <div className="max-w-xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Release Booking Funds</h1>
        <p className="text-sm text-ink-3 mt-1">
          Manual override — retry stuck, FAILED, or UNKNOWN releases. Normal releases are handled
          automatically by the scheduler.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="Paste booking ID"
          className="flex-1 px-3 py-2 border border-line rounded text-sm font-mono"
        />
        <button
          onClick={handleRelease}
          disabled={loading || !bookingId.trim()}
          className="px-4 py-2 bg-ink text-white text-sm rounded disabled:opacity-50"
        >
          {loading ? 'Releasing...' : 'Release'}
        </button>
      </div>

      {error && <div className="mt-4 p-3 bg-danger/10 text-danger text-sm rounded">{error}</div>}

      {result && (
        <div className="mt-4 space-y-2">
          <div
            className={`inline-block px-3 py-1 text-sm font-medium rounded ${statusColor[result.status] || 'text-ink-2 bg-page'}`}
          >
            {result.status}
          </div>
          {result.transferId && (
            <p className="text-sm text-ink-2">
              Transfer ID: <code className="font-mono">{result.transferId}</code>
            </p>
          )}
          {result.reason && <p className="text-sm text-ink-2">Reason: {result.reason}</p>}
        </div>
      )}
    </div>
  );
}
