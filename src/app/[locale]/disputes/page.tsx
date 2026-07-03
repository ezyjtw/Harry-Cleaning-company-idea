'use client';

import { useEffect, useState } from 'react';

import { AccountSection, Field } from '@/components/account/primitives';
import { DISPUTE_REASONS, getDisputeStatusLabel } from '@/lib/trust';
import type { Dispute, DisputeReason } from '@/lib/types';

export default function DisputesPage() {
  const [activeView, setActiveView] = useState<'list' | 'new'>('list');
  const [newDispute, setNewDispute] = useState({
    bookingId: '',
    reason: 'poor-quality' as DisputeReason,
    description: '',
  });
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/disputes')
      .then((r) => (r.ok ? r.json() : { disputes: [] }))
      .then((data) => setDisputes(data.disputes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAddEvidence = () => {
    setEvidenceFiles([...evidenceFiles, `evidence-${evidenceFiles.length + 1}.jpg`]);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDispute),
      });
      if (res.ok) {
        setSubmitted(true);
        setActiveView('list');
        // Refresh disputes
        const data = await fetch('/api/disputes').then((r) => r.json());
        setDisputes(data.disputes || []);
      }
    } catch {
      // Handle error
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-newsreader text-3xl font-semibold text-ink">Dispute Resolution</h1>
          <p className="mt-2 text-ink-2">
            We take every dispute seriously. Both parties can submit evidence, and our team reviews
            within 24–48 hours.
          </p>
        </div>
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
      {activeView === 'new' && (
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
                placeholder="Describe the issue in detail. Include times, specific problems, and any communication you had with the other party..."
                value={newDispute.description}
                onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
                className="mt-1 w-full rounded-[10px] border border-line px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Evidence upload */}
            <div className="mt-6">
              <label className="block font-jost text-sm font-medium text-ink-2">Evidence</label>
              <p className="mt-1 text-xs text-ink-3">
                Upload photos, videos, or screenshots. Stronger evidence leads to faster resolution.
              </p>

              {evidenceFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {evidenceFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-[8px] bg-page px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm text-ink-2">
                        <svg className="h-4 w-4 text-ink-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {file}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEvidenceFiles(evidenceFiles.filter((_, idx) => idx !== i))
                        }
                        className="text-xs text-danger hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddEvidence}
                className="mt-3 w-full rounded-[10px] border-2 border-dashed border-line px-4 py-3 text-sm text-ink-3 transition hover:border-primary hover:text-primary"
              >
                + Upload Photo / Video / Screenshot
              </button>
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

            <button
              type="submit"
              className="mt-6 w-full rounded-[10px] bg-danger py-3 text-base font-semibold text-white transition-colors hover:bg-red-700"
            >
              Submit Dispute
            </button>
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
                          Dispute #{dispute.id}
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
                    <div className="shrink-0 text-sm text-ink-3">Booking: {dispute.bookingId}</div>
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
                            className="flex items-center justify-between rounded-[8px] bg-page px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-[6px] px-2 py-0.5 text-xs font-medium ${
                                  ev.type === 'photo'
                                    ? 'bg-primary-soft text-primary'
                                    : ev.type === 'timestamp'
                                      ? 'bg-ink/[0.06] text-ink'
                                      : 'bg-page text-ink-2'
                                }`}
                              >
                                {ev.type}
                              </span>
                              <span className="text-ink-2">{ev.description}</span>
                            </div>
                            <span className="text-xs text-ink-3">by {ev.uploadedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response area (for other party) */}
                  {dispute.status === 'under-review' && (
                    <div className="mt-4 rounded-[10px] border border-primary/20 bg-primary-soft p-3">
                      <p className="text-sm text-primary">
                        This dispute is under review. You can add additional evidence or information
                        to strengthen your case.
                      </p>
                      <button className="mt-2 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover">
                        Add More Evidence
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
