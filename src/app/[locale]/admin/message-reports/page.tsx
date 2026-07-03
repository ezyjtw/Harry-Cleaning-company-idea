'use client';

import { useCallback, useEffect, useState } from 'react';

interface MessageReport {
  id: string;
  origin: 'USER' | 'SYSTEM';
  reason: string;
  details: string | null;
  createdAt: string;
  bookingId: string;
  messageContent: string;
  messageAt: string;
  reporterName: string | null;
  reporterEmail: string | null;
  reportedName: string | null;
  reportedEmail: string | null;
}

const REASON_LABEL: Record<string, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Harassment',
  OFF_PLATFORM: 'Off-platform / circumvention',
  INAPPROPRIATE: 'Inappropriate',
  OTHER: 'Other',
};

export default function AdminMessageReportsPage() {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/message-reports');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      setStatusMessage('Failed to load message reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const resolve = async (id: string, action: 'ACTION' | 'DISMISS') => {
    setProcessingId(id);
    setStatusMessage('');
    try {
      const res = await fetch(`/api/admin/message-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNotes: notesById[id] }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(data?.message || 'Report resolved.');
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to resolve report.'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setProcessingId(null);
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
        <h1 className="text-2xl font-semibold text-ink">Message reports</h1>
        <p className="mt-1 text-sm text-ink-2">
          Reports filed by users against messages they received. Action (take moderation steps) or
          dismiss each report.
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
            <div key={i} className="h-40 animate-pulse rounded-lg bg-line" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-ink-3">No open message reports.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.origin === 'SYSTEM'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-primary-soft text-primary'
                    }`}
                  >
                    {r.origin === 'SYSTEM' ? 'Auto-flagged' : 'User report'}
                  </span>
                </div>
                <span className="text-xs text-ink-3">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </span>
              </div>

              <div className="mt-4 rounded-lg bg-page p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  Reported message
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.messageContent}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                    Reported user
                  </p>
                  <p className="text-sm text-ink">{r.reportedName || 'User'}</p>
                  {r.reportedEmail && <p className="text-xs text-ink-3">{r.reportedEmail}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                    Reported by
                  </p>
                  {r.origin === 'SYSTEM' ? (
                    <p className="text-sm text-ink">Auto-flagged: possible contact info</p>
                  ) : (
                    <>
                      <p className="text-sm text-ink">{r.reporterName || 'User'}</p>
                      {r.reporterEmail && <p className="text-xs text-ink-3">{r.reporterEmail}</p>}
                    </>
                  )}
                </div>
              </div>

              {r.details && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                    Reporter&rsquo;s note
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{r.details}</p>
                </div>
              )}

              <textarea
                value={notesById[r.id] ?? ''}
                onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                rows={2}
                maxLength={1000}
                placeholder="Internal notes (optional)"
                className="mt-4 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-line"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => resolve(r.id, 'ACTION')}
                  disabled={processingId === r.id}
                  className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white hover:bg-danger disabled:opacity-50"
                >
                  {processingId === r.id ? 'Working…' : 'Action'}
                </button>
                <button
                  onClick={() => resolve(r.id, 'DISMISS')}
                  disabled={processingId === r.id}
                  className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink-2 hover:bg-page disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
