'use client';

import { useEffect, useRef, useState } from 'react';

import { AccountSection, Field } from '@/components/account/primitives';
import { DISPUTE_REASONS, getDisputeStatusLabel } from '@/lib/trust';
import type { Dispute, DisputeReason, DisputeStatus } from '@/lib/types';

// Mirrors the server: images + PDF only (the magic-byte validator whitelists
// jpeg/png/webp/pdf). Video is not yet supported by the shared validator.
const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10 MB — matches MAX_EVIDENCE_SIZE server-side

type StagedStatus = 'staged' | 'uploading' | 'done' | 'error';
interface StagedFile {
  id: string;
  file: File;
  status: StagedStatus;
  error?: string;
}

// A dispute still accepts evidence while it is open or under review.
const canAddEvidence = (status: DisputeStatus): boolean =>
  status === 'open' || status === 'under-review';

// Evidence-type chip styling, keyed by the Prisma EvidenceType enum.
const evidenceChip: Record<string, string> = {
  PHOTO: 'bg-primary-soft text-primary',
  VIDEO: 'bg-warning/10 text-warning',
  DOCUMENT: 'bg-ink/[0.06] text-ink',
  TEXT: 'bg-page text-ink-2',
};

export default function DisputesPage() {
  const [activeView, setActiveView] = useState<'list' | 'new'>('list');
  // F9: cleaners view + evidence their disputes here, but only customers file
  // (the API 403s cleaner filings) — hide the form for them.
  const [role, setRole] = useState<string | null>(null);
  const [newDispute, setNewDispute] = useState({
    bookingId: '',
    reason: 'poor-quality' as DisputeReason,
    description: '',
  });
  const [evidenceFiles, setEvidenceFiles] = useState<StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Once the dispute is filed, its id is pinned here so failed uploads can retry
  // against it without re-filing (the dispute already exists).
  const [filedDisputeId, setFiledDisputeId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [_loading, setLoading] = useState(true);

  const fileIdRef = useRef(0);
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);
  const addMoreDisputeIdRef = useRef<string | null>(null);
  const [addMoreBusyId, setAddMoreBusyId] = useState<string | null>(null);

  const refreshDisputes = async () => {
    const data = await fetch('/api/disputes').then((r) => (r.ok ? r.json() : { disputes: [] }));
    setDisputes(data.disputes || []);
  };

  useEffect(() => {
    fetch('/api/disputes')
      .then((r) => (r.ok ? r.json() : { disputes: [] }))
      .then((data) => setDisputes(data.disputes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // F9: role decides form visibility (cleaners view/evidence, customers file);
    // ?bookingId deep-links straight into a prefilled report (account-bookings
    // entry + emails).
    fetch('/api/auth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.user?.role ?? d?.role ?? null))
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const bid = params.get('bookingId');
    if (bid) {
      setNewDispute((prev) => ({ ...prev, bookingId: bid }));
      setActiveView('new');
    }
  }, []);

  const stageFiles = (list: FileList | null) => {
    if (!list) return;
    const staged: StagedFile[] = Array.from(list).map((file) => {
      const id = `f${fileIdRef.current++}`;
      if (file.size > MAX_EVIDENCE_SIZE) {
        return { id, file, status: 'error', error: 'File too large. Maximum size is 10MB.' };
      }
      return { id, file, status: 'staged' };
    });
    setEvidenceFiles((prev) => [...prev, ...staged]);
  };

  // Upload one staged file to a dispute that already exists. Returns success.
  const uploadStaged = async (disputeId: string, sf: StagedFile): Promise<boolean> => {
    setEvidenceFiles((prev) =>
      prev.map((f) => (f.id === sf.id ? { ...f, status: 'uploading', error: undefined } : f))
    );
    try {
      const form = new FormData();
      form.append('file', sf.file);
      const res = await fetch(`/api/disputes/${disputeId}/evidence`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        setEvidenceFiles((prev) =>
          prev.map((f) => (f.id === sf.id ? { ...f, status: 'done' } : f))
        );
        return true;
      }
      const data = await res.json().catch(() => ({}));
      setEvidenceFiles((prev) =>
        prev.map((f) =>
          f.id === sf.id ? { ...f, status: 'error', error: data.error || 'Upload failed.' } : f
        )
      );
      return false;
    } catch {
      setEvidenceFiles((prev) =>
        prev.map((f) => (f.id === sf.id ? { ...f, status: 'error', error: 'Network error.' } : f))
      );
      return false;
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      // File the dispute via the real endpoint (bookingId lives in the URL).
      let disputeId = filedDisputeId;
      if (!disputeId) {
        const res = await fetch(
          `/api/bookings/${encodeURIComponent(newDispute.bookingId)}/dispute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: newDispute.reason,
              description: newDispute.description,
            }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.disputeId) {
          setSubmitError(data.error || 'Could not file dispute. Check the booking reference.');
          setSubmitting(false);
          return;
        }
        disputeId = data.disputeId as string;
        setFiledDisputeId(disputeId);
      }

      // Dispute now exists — upload each pending file. Failures don't lose it.
      const pending = evidenceFiles.filter((f) => f.status === 'staged' || f.status === 'error');
      const results = await Promise.all(pending.map((sf) => uploadStaged(disputeId as string, sf)));
      const allOk = results.every(Boolean);

      if (allOk) {
        setSubmitted(true);
        setActiveView('list');
        await refreshDisputes();
        // Reset the form for a fresh dispute.
        setNewDispute({ bookingId: '', reason: 'poor-quality', description: '' });
        setEvidenceFiles([]);
        setFiledDisputeId(null);
      }
      // If some uploads failed, stay on the form: the dispute is filed and the
      // failed rows show a Retry control below.
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // "Add More Evidence" on an existing dispute → immediate upload, then refresh.
  const openAddMore = (disputeId: string) => {
    addMoreDisputeIdRef.current = disputeId;
    addMoreInputRef.current?.click();
  };

  const handleAddMoreFiles = async (list: FileList | null) => {
    const disputeId = addMoreDisputeIdRef.current;
    if (!disputeId || !list || list.length === 0) return;
    setAddMoreBusyId(disputeId);
    try {
      for (const file of Array.from(list)) {
        if (file.size > MAX_EVIDENCE_SIZE) continue;
        const form = new FormData();
        form.append('file', file);
        await fetch(`/api/disputes/${disputeId}/evidence`, { method: 'POST', body: form }).catch(
          () => {}
        );
      }
      await refreshDisputes();
    } finally {
      setAddMoreBusyId(null);
      addMoreDisputeIdRef.current = null;
      if (addMoreInputRef.current) addMoreInputRef.current.value = '';
    }
  };

  const pendingCount = evidenceFiles.filter(
    (f) => f.status === 'staged' || f.status === 'error'
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Shared hidden input for the list view's "Add More Evidence". */}
      <input
        ref={addMoreInputRef}
        type="file"
        accept={EVIDENCE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleAddMoreFiles(e.target.files)}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-newsreader text-3xl font-semibold text-ink">Dispute Resolution</h1>
          <p className="mt-2 text-ink-2">
            We take every dispute seriously. Both parties can submit evidence, and our team reviews
            within 24–48 hours.
          </p>
        </div>
        {role !== 'CLEANER' && (
        <button
          onClick={() => setActiveView(activeView === 'new' ? 'list' : 'new')}
          className={`shrink-0 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeView === 'new'
              ? 'border border-line bg-surface text-ink-2 hover:bg-page'
              : 'bg-danger text-white hover:bg-red-700'
          }`}
        >
          {activeView === 'new' ? 'Back to Disputes' : 'File a Dispute'}
        </button>
        )}
      </div>

      {/* Success message */}
      {submitted && (
        <div className="mt-6 rounded-[10px] border border-trust/20 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-trust" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-trust">
              Dispute submitted. Our team will review within 24–48 hours. Your held payment is now
              frozen until resolution.
            </span>
          </div>
        </div>
      )}

      {/* ─── New Dispute Form ─── */}
      {activeView === 'new' && role !== 'CLEANER' && (
        <form onSubmit={handleSubmitDispute} className="mt-8">
          <AccountSection title="File a New Dispute">
            <p className="mt-1 text-sm text-ink-3">
              Please provide as much detail and evidence as possible. This helps us resolve disputes
              fairly for both parties.
            </p>

            {/* Booking ID */}
            <div className="mt-6">
              <Field
                id="dispute-booking"
                label="Booking Reference"
                type="text"
                required
                disabled={!!filedDisputeId}
                placeholder="e.g. b3"
                value={newDispute.bookingId}
                onChange={(e) => setNewDispute({ ...newDispute, bookingId: e.target.value })}
              />
            </div>

            {/* Reason */}
            <div className="mt-6">
              <label className="block font-jost text-sm font-medium text-ink-2">
                Reason for Dispute
              </label>
              <div className="mt-3 space-y-2">
                {DISPUTE_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition ${
                      newDispute.reason === reason.value
                        ? 'border-primary bg-primary-soft ring-1 ring-primary'
                        : 'border-line hover:border-ink-3/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      checked={newDispute.reason === reason.value}
                      disabled={!!filedDisputeId}
                      onChange={() => setNewDispute({ ...newDispute, reason: reason.value })}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-ink">{reason.label}</div>
                      <div className="text-xs text-ink-3">{reason.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <label className="block font-jost text-sm font-medium text-ink-2">
                What happened?
              </label>
              <textarea
                required
                rows={4}
                disabled={!!filedDisputeId}
                placeholder="Describe the issue in detail. Include times, specific problems, and any communication you had with the other party..."
                value={newDispute.description}
                onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
                className="mt-1 w-full rounded-[10px] border border-line px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-page disabled:text-ink-3"
              />
            </div>

            {/* Evidence upload */}
            <div className="mt-6">
              <label className="block font-jost text-sm font-medium text-ink-2">Evidence</label>
              <p className="mt-1 text-xs text-ink-3">
                Upload photos or PDFs (max 10MB each). Stronger evidence leads to faster resolution.
              </p>

              {evidenceFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {evidenceFiles.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center justify-between gap-3 rounded-[8px] bg-page px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-ink-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="truncate">{sf.file.name}</span>
                        {sf.status === 'uploading' && (
                          <span className="shrink-0 text-xs text-ink-3">Uploading…</span>
                        )}
                        {sf.status === 'done' && (
                          <span className="shrink-0 text-xs font-medium text-trust">
                            ✓ Uploaded
                          </span>
                        )}
                        {sf.status === 'error' && (
                          <span className="shrink-0 text-xs text-danger">{sf.error}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {sf.status === 'error' && filedDisputeId && (
                          <button
                            type="button"
                            onClick={() => uploadStaged(filedDisputeId, sf)}
                            className="text-xs font-medium text-primary hover:text-primary-hover"
                          >
                            Retry
                          </button>
                        )}
                        {sf.status !== 'done' && sf.status !== 'uploading' && (
                          <button
                            type="button"
                            onClick={() =>
                              setEvidenceFiles((prev) => prev.filter((f) => f.id !== sf.id))
                            }
                            className="text-xs text-danger hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-3 block w-full cursor-pointer rounded-[10px] border-2 border-dashed border-line px-4 py-3 text-center text-sm text-ink-3 transition hover:border-primary hover:text-primary">
                + Upload Photo / PDF
                <input
                  type="file"
                  accept={EVIDENCE_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    stageFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Fair warning */}
            <div className="mt-6 rounded-[10px] border border-warning/25 bg-warning/[0.06] p-4">
              <h4 className="text-sm font-medium text-warning">How disputes work</h4>
              <ul className="mt-2 space-y-1 text-xs text-ink-2">
                <li>&bull; Your held payment is frozen immediately when a dispute is filed.</li>
                <li>
                  &bull; The other party has 24 hours to respond with their side and evidence.
                </li>
                <li>&bull; Our team reviews all evidence and resolves within 24–48 hours.</li>
                <li>&bull; Outcomes: full refund, full payment to cleaner, or a fair split.</li>
                <li>&bull; Repeated false disputes may result in account restrictions.</li>
              </ul>
            </div>

            {submitError && (
              <div className="mt-4 rounded-[10px] border border-danger/20 bg-red-50 p-3 text-sm text-danger">
                {submitError}
              </div>
            )}

            {filedDisputeId && pendingCount > 0 ? (
              <>
                <p className="mt-6 text-sm text-ink-2">
                  Your dispute has been filed, but {pendingCount} file
                  {pendingCount === 1 ? '' : 's'} failed to upload. Retry above, or finish and add
                  them later.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {submitting ? 'Retrying…' : 'Retry failed uploads'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSubmitted(true);
                      setActiveView('list');
                      await refreshDisputes();
                      setNewDispute({ bookingId: '', reason: 'poor-quality', description: '' });
                      setEvidenceFiles([]);
                      setFiledDisputeId(null);
                    }}
                    className="rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-page"
                  >
                    Finish
                  </button>
                </div>
              </>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-[10px] bg-danger py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Dispute'}
              </button>
            )}
          </AccountSection>
        </form>
      )}

      {/* ─── Dispute List ─── */}
      {activeView === 'list' && (
        <div className="mt-8 space-y-4">
          {disputes.length === 0 && !submitted ? (
            <div className="rounded-[10px] bg-page p-8 text-center">
              <p className="text-ink-3">No disputes. That&apos;s great!</p>
            </div>
          ) : (
            disputes.map((dispute) => {
              const statusInfo = getDisputeStatusLabel(dispute.status);
              return (
                <div key={dispute.id} className="rounded-xl border border-line bg-surface p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-newsreader text-lg font-semibold text-ink">
                          Dispute #{dispute.id.substring(0, 8).toUpperCase()}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-3">
                        Filed by {dispute.filedByName} ({dispute.filedBy}) on{' '}
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm text-ink-3">
                      Booking: {dispute.bookingId.substring(0, 8).toUpperCase()}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-medium text-ink-2">
                      Reason:{' '}
                      <span className="font-normal">
                        {DISPUTE_REASONS.find((r) => r.value === dispute.reason)?.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{dispute.description}</p>
                  </div>

                  {/* Evidence */}
                  {dispute.evidence.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
                        Evidence ({dispute.evidence.length})
                      </h4>
                      <div className="mt-2 space-y-2">
                        {dispute.evidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between gap-3 rounded-[8px] bg-page px-3 py-2 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 rounded-[6px] px-2 py-0.5 text-xs font-medium ${
                                  evidenceChip[ev.type] ?? 'bg-page text-ink-2'
                                }`}
                              >
                                {ev.type.toLowerCase()}
                              </span>
                              <span className="truncate text-ink-2">
                                {ev.fileName || ev.description}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              {ev.url && (
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-medium text-primary hover:text-primary-hover"
                                >
                                  View
                                </a>
                              )}
                              <span className="text-xs text-ink-3">by {ev.uploadedBy}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add evidence — available to parties while the dispute is unresolved. */}
                  {canAddEvidence(dispute.status) && (
                    <button
                      type="button"
                      onClick={() => openAddMore(dispute.id)}
                      disabled={addMoreBusyId === dispute.id}
                      className="mt-3 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
                    >
                      {addMoreBusyId === dispute.id ? 'Uploading…' : '+ Add evidence'}
                    </button>
                  )}

                  {/* Response area (for other party) */}
                  {dispute.status === 'under-review' && (
                    <div className="mt-4 rounded-[10px] border border-primary/20 bg-primary-soft p-3">
                      <p className="text-sm text-primary">
                        This dispute is under review. You can add additional evidence or information
                        to strengthen your case.
                      </p>
                      <button
                        type="button"
                        onClick={() => openAddMore(dispute.id)}
                        disabled={addMoreBusyId === dispute.id}
                        className="mt-2 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                      >
                        {addMoreBusyId === dispute.id ? 'Uploading…' : 'Add More Evidence'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
