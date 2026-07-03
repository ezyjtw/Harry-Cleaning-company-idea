'use client';

import { useCallback, useEffect, useState } from 'react';

interface PendingImportedReview {
  id: string;
  cleanerId: string;
  cleanerName: string | null;
  cleanerEmail: string | null;
  cleanerVerified: boolean;
  rating: number;
  text: string | null;
  source: string;
  reviewerName: string | null;
  referenceContacts: string | null;
  hasEvidence: boolean;
  evidenceUrl: string | null;
  createdAt: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-rating" aria-label={`${rating} out of 5`}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-ink-3">{'★'.repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export default function AdminImportedReviewsPage() {
  const [reviews, setReviews] = useState<PendingImportedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/imported-reviews');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch {
      setStatusMessage('Failed to load pending imported reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const viewEvidence = (id: string) => {
    window.open(`/api/admin/imported-reviews/${id}/evidence`, '_blank', 'noopener,noreferrer');
  };

  const act = async (id: string, action: 'VERIFY' | 'REJECT', adminNotes?: string) => {
    setProcessingId(id);
    setStatusMessage('');
    try {
      const res = await fetch(`/api/admin/imported-reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNotes }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(
          data?.message || `Review ${action === 'VERIFY' ? 'verified' : 'rejected'}.`
        );
        setReviews((prev) => prev.filter((r) => r.id !== id));
        setRejectingId(null);
        setRejectNote('');
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to process review.'}`);
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
        <h1 className="text-2xl font-semibold text-ink">Imported reviews</h1>
        <p className="mt-1 text-sm text-ink-2">
          Verify reviews cleaners have imported from external platforms. Approving counts the review
          toward the cleaner&rsquo;s overall rating and shows it publicly, marked &ldquo;Imported
          from&rdquo;. Rejecting requires a reason (shown to the cleaner).
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
      ) : reviews.length === 0 ? (
        <p className="text-sm text-ink-3">No imported reviews are awaiting verification.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{r.cleanerName || 'Cleaner'}</span>
                    {r.cleanerVerified ? (
                      <span className="inline-flex items-center rounded-full bg-trust/10 px-2 py-0.5 text-xs font-medium text-trust">
                        Verified cleaner
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink-2">
                        Unverified cleaner
                      </span>
                    )}
                  </div>
                  {r.cleanerEmail && <p className="text-xs text-ink-3">{r.cleanerEmail}</p>}
                </div>
                <span className="text-xs text-ink-3">
                  Submitted {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Source</p>
                  <p className="text-sm text-ink">{r.source}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Rating</p>
                  <p className="text-sm">
                    <Stars rating={r.rating} /> <span className="text-ink-2">{r.rating} / 5</span>
                  </p>
                </div>
                {r.reviewerName && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                      Reviewer
                    </p>
                    <p className="text-sm text-ink">{r.reviewerName}</p>
                  </div>
                )}
                {r.referenceContacts && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                      Reference contact
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink">{r.referenceContacts}</p>
                  </div>
                )}
              </div>

              {r.text && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                    Review text
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{r.text}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {r.hasEvidence ? (
                  <button
                    onClick={() => viewEvidence(r.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-page"
                  >
                    View evidence
                  </button>
                ) : (
                  <span className="text-xs text-ink-3">No evidence attached</span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => act(r.id, 'VERIFY')}
                    disabled={processingId === r.id}
                    className="rounded-lg bg-trust px-4 py-1.5 text-sm font-medium text-white hover:bg-trust disabled:opacity-50"
                  >
                    {processingId === r.id ? 'Working…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(rejectingId === r.id ? null : r.id);
                      setRejectNote('');
                    }}
                    disabled={processingId === r.id}
                    className="rounded-lg border border-danger/30 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {rejectingId === r.id && (
                <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3">
                  <label className="text-xs font-medium text-danger">
                    Reason for rejection (shown to the cleaner)
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="e.g. Couldn't verify this against the source platform."
                    className="mt-1.5 w-full rounded-lg border border-danger/20 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-danger/30"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => act(r.id, 'REJECT', rejectNote.trim())}
                      disabled={processingId === r.id || !rejectNote.trim()}
                      className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white hover:bg-danger disabled:opacity-50"
                    >
                      Confirm rejection
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectNote('');
                      }}
                      className="text-sm text-ink-3 hover:text-ink-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
