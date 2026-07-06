'use client';

import { useCallback, useEffect, useState } from 'react';

interface DeletionRequest {
  id: string;
  userId: string;
  email: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  processedBy: string | null;
}

export default function AdminCompliancePage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/compliance?section=deletions');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const act = async (id: string, action: 'approve_deletion' | 'reject_deletion', notes?: string) => {
    setProcessingId(id);
    setStatusMessage('');
    try {
      const res = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId: id, notes }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(data?.message || 'Done.');
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to process request.'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setProcessingId(null);
      setConfirmingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 lg:p-10">
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-5 py-4">
          <p className="text-sm font-medium text-danger">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Compliance — data deletion requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          GDPR right-to-erasure requests. Approving executes the erasure immediately and
          irreversibly: the user is anonymised, addresses deleted, identity documents destroyed
          (except those under a statutory retention hold), messages redacted, and consents
          withdrawn. Bookings and payments are retained for the 6-year tax/legal period.
        </p>
      </header>

      {statusMessage && (
        <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{statusMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-line" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-ink-3">No deletion requests awaiting action.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.email}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'APPROVED' || r.status === 'IN_PROGRESS'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-primary-soft text-primary'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">User ID: {r.userId}</p>
                  {r.reason && <p className="mt-2 text-sm text-ink-2">Reason: {r.reason}</p>}
                </div>
                <span className="text-xs text-ink-3">
                  Requested {new Date(r.requestedAt).toLocaleDateString('en-GB')}
                </span>
              </div>

              {confirmingId === r.id ? (
                <div className="mt-4 rounded-[10px] border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm text-ink-2">
                    Permanently erase {r.email}? This anonymises the user, deletes addresses,
                    destroys identity documents (except those under a statutory hold), redacts
                    messages, and withdraws consents. Bookings/payments are retained (tax law).{' '}
                    <span className="font-medium text-danger">This cannot be undone.</span>
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => act(r.id, 'approve_deletion')}
                      disabled={processingId === r.id}
                      className="rounded-[10px] bg-danger px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                    >
                      {processingId === r.id ? 'Erasing…' : 'Yes, erase permanently'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={processingId === r.id}
                      className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingId(r.id)}
                    disabled={processingId === r.id}
                    className="rounded-[10px] bg-danger px-4 py-2 font-jost text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                  >
                    Approve &amp; erase
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, 'reject_deletion')}
                    disabled={processingId === r.id}
                    className="rounded-[10px] border border-line px-4 py-2 font-jost text-sm font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
