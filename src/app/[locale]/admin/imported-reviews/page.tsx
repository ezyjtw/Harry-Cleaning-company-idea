'use client';

import { useCallback, useEffect, useState } from 'react';

import CleanerAvatar from '@/components/CleanerAvatar';

// H24 (James-ruled): the reviews surface is CLEANER-FIRST — the same playbook
// as the verification-queue restructure. The list is cleaners with reviews
// needing action (pending imports / flagged natives), newest first; clicking
// one opens their full review dossier (native + imported, source-labelled)
// with the per-review machinery: verify/reject imports, hide/unhide/flag
// natives. Presentation over existing APIs, plus one thin new route exposing
// the pre-existing moderateReview service.

interface ImportedReviewRow {
  id: string;
  rating: number;
  text: string | null;
  source: string;
  reviewerName: string | null;
  referenceContacts: string | null;
  hasEvidence: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminNotes: string | null;
  createdAt: string;
}

interface NativeReviewRow {
  id: string;
  rating: number;
  text: string | null;
  clientName: string;
  visibility: 'VISIBLE' | 'HIDDEN' | 'FLAGGED';
  isModerated: boolean;
  createdAt: string;
}

interface ReviewCleaner {
  cleanerId: string;
  name: string;
  email: string | null;
  photo: string | null;
  verified: boolean;
  rating: number;
  pendingImportedCount: number;
  flaggedNativeCount: number;
  newestActionAt: string;
  importedReviews: ImportedReviewRow[];
  nativeReviews: NativeReviewRow[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-rating" aria-label={`${rating} out of 5`}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-ink-3">{'★'.repeat(Math.max(0, 5 - Math.round(rating)))}</span>
    </span>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: 'amber' | 'danger' | 'trust' | 'muted';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-800'
      : tone === 'danger'
        ? 'bg-danger/10 text-danger'
        : tone === 'trust'
          ? 'bg-trust/10 text-trust'
          : 'bg-page text-ink-2';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [cleaners, setCleaners] = useState<ReviewCleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/imported-reviews');
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCleaners(data.cleaners || []);
      }
    } catch {
      setStatusMessage('Failed to load the review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const viewEvidence = (id: string) => {
    window.open(`/api/admin/imported-reviews/${id}/evidence`, '_blank', 'noopener,noreferrer');
  };

  const actImported = async (id: string, action: 'VERIFY' | 'REJECT', adminNotes?: string) => {
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
        setRejectingId(null);
        setRejectNote('');
        await fetchQueue();
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to process review.'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server.');
    } finally {
      setProcessingId(null);
    }
  };

  const actNative = async (id: string, action: 'VISIBLE' | 'HIDDEN' | 'FLAGGED') => {
    setProcessingId(id);
    setStatusMessage('');
    try {
      const res = await fetch(`/api/admin/reviews/${id}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage(
          action === 'HIDDEN'
            ? 'Review hidden — it no longer counts toward the rating.'
            : action === 'VISIBLE'
              ? 'Review visible — it counts toward the rating.'
              : 'Review flagged for follow-up.'
        );
        await fetchQueue();
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to moderate review.'}`);
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

  const selected = selectedId ? cleaners.find((c) => c.cleanerId === selectedId) : null;

  // ── Dossier view ──────────────────────────────────────────────────────────
  if (selected) {
    const merged: (
      | { kind: 'imported'; row: ImportedReviewRow }
      | { kind: 'native'; row: NativeReviewRow }
    )[] = [
      ...selected.importedReviews.map((row) => ({ kind: 'imported' as const, row })),
      ...selected.nativeReviews.map((row) => ({ kind: 'native' as const, row })),
    ].sort((a, b) => new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime());

    return (
      <div className="p-6 lg:p-10">
        <button
          onClick={() => setSelectedId(null)}
          className="mb-5 text-sm font-medium text-ink-2 hover:text-ink"
        >
          ← All cleaners
        </button>

        <header className="mb-6 flex items-center gap-4">
          <CleanerAvatar photo={selected.photo} name={selected.name} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{selected.name}</h1>
              {selected.verified ? (
                <Chip tone="trust">Verified cleaner</Chip>
              ) : (
                <Chip tone="muted">Unverified cleaner</Chip>
              )}
            </div>
            <p className="text-sm text-ink-3">
              {selected.email} · current rating {selected.rating.toFixed(1)}
            </p>
          </div>
        </header>

        {statusMessage && (
          <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink-2">{statusMessage}</p>
          </div>
        )}

        <div className="space-y-4">
          {merged.length === 0 && <p className="text-sm text-ink-3">No reviews.</p>}
          {merged.map((entry) =>
            entry.kind === 'imported' ? (
              <div
                key={entry.row.id}
                className="rounded-lg border border-line bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="muted">Imported · {entry.row.source}</Chip>
                  {entry.row.verificationStatus === 'PENDING' && (
                    <Chip tone="amber">Awaiting verification</Chip>
                  )}
                  {entry.row.verificationStatus === 'VERIFIED' && (
                    <Chip tone="trust">Verified</Chip>
                  )}
                  {entry.row.verificationStatus === 'REJECTED' && (
                    <Chip tone="danger">Rejected</Chip>
                  )}
                  <span className="ml-auto text-xs text-ink-3">
                    {new Date(entry.row.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <Stars rating={entry.row.rating} />{' '}
                  <span className="text-ink-2">{entry.row.rating} / 5</span>
                  {entry.row.reviewerName && (
                    <span className="text-ink-3"> · {entry.row.reviewerName}</span>
                  )}
                </p>
                {entry.row.text && <p className="mt-2 text-sm text-ink-2">{entry.row.text}</p>}
                {entry.row.referenceContacts && (
                  <p className="mt-2 whitespace-pre-line text-xs text-ink-3">
                    Reference: {entry.row.referenceContacts}
                  </p>
                )}
                {entry.row.adminNotes && entry.row.verificationStatus === 'REJECTED' && (
                  <p className="mt-2 text-xs text-danger">Rejection note: {entry.row.adminNotes}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {entry.row.hasEvidence ? (
                    <button
                      onClick={() => viewEvidence(entry.row.id)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-page"
                    >
                      View evidence
                    </button>
                  ) : (
                    <span className="text-xs text-ink-3">No evidence attached</span>
                  )}
                  {entry.row.verificationStatus === 'PENDING' && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => actImported(entry.row.id, 'VERIFY')}
                        disabled={processingId === entry.row.id}
                        className="rounded-lg bg-trust px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {processingId === entry.row.id ? 'Working…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(rejectingId === entry.row.id ? null : entry.row.id);
                          setRejectNote('');
                        }}
                        disabled={processingId === entry.row.id}
                        className="rounded-lg border border-danger/30 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {rejectingId === entry.row.id && (
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
                        onClick={() => actImported(entry.row.id, 'REJECT', rejectNote.trim())}
                        disabled={processingId === entry.row.id || !rejectNote.trim()}
                        className="rounded-lg bg-danger px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
            ) : (
              <div
                key={entry.row.id}
                className="rounded-lg border border-line bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="muted">Rena review · {entry.row.clientName}</Chip>
                  {entry.row.visibility === 'VISIBLE' && <Chip tone="trust">Visible</Chip>}
                  {entry.row.visibility === 'HIDDEN' && <Chip tone="muted">Hidden</Chip>}
                  {entry.row.visibility === 'FLAGGED' && <Chip tone="danger">Flagged</Chip>}
                  <span className="ml-auto text-xs text-ink-3">
                    {new Date(entry.row.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <Stars rating={entry.row.rating} />{' '}
                  <span className="text-ink-2">{entry.row.rating} / 5</span>
                </p>
                {entry.row.text && <p className="mt-2 text-sm text-ink-2">{entry.row.text}</p>}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {entry.row.visibility !== 'HIDDEN' && (
                    <button
                      onClick={() => actNative(entry.row.id, 'HIDDEN')}
                      disabled={processingId === entry.row.id}
                      className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink-2 hover:bg-page disabled:opacity-50"
                    >
                      Hide
                    </button>
                  )}
                  {entry.row.visibility !== 'VISIBLE' && (
                    <button
                      onClick={() => actNative(entry.row.id, 'VISIBLE')}
                      disabled={processingId === entry.row.id}
                      className="rounded-lg bg-trust px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {entry.row.visibility === 'FLAGGED' ? 'Clear flag & show' : 'Unhide'}
                    </button>
                  )}
                  {entry.row.visibility === 'VISIBLE' && (
                    <button
                      onClick={() => actNative(entry.row.id, 'FLAGGED')}
                      disabled={processingId === entry.row.id}
                      className="rounded-lg border border-danger/30 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Flag
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // ── Cleaner list view ─────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Reviews</h1>
        <p className="mt-1 text-sm text-ink-2">
          Cleaners with reviews needing action — newest first. Open a cleaner to see their full
          review dossier (Rena + imported) and act on each review.
        </p>
      </header>

      {statusMessage && (
        <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink-2">{statusMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-line" />
          ))}
        </div>
      ) : cleaners.length === 0 ? (
        <p className="text-sm text-ink-3">No reviews are awaiting action.</p>
      ) : (
        <div className="space-y-3">
          {cleaners.map((c) => (
            <button
              key={c.cleanerId}
              onClick={() => setSelectedId(c.cleanerId)}
              className="flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-left shadow-sm transition-colors hover:bg-page"
            >
              <CleanerAvatar photo={c.photo} name={c.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{c.name}</span>
                  {c.verified ? (
                    <Chip tone="trust">Verified</Chip>
                  ) : (
                    <Chip tone="muted">Unverified</Chip>
                  )}
                </div>
                <p className="truncate text-xs text-ink-3">{c.email}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {c.pendingImportedCount > 0 && (
                  <Chip tone="amber">{c.pendingImportedCount} imported awaiting verification</Chip>
                )}
                {c.flaggedNativeCount > 0 && (
                  <Chip tone="danger">{c.flaggedNativeCount} flagged</Chip>
                )}
                <span className="text-xs text-ink-3">
                  {new Date(c.newestActionAt).toLocaleDateString('en-GB')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
