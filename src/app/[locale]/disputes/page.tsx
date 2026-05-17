'use client';

import { useEffect, useState } from 'react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispute Resolution</h1>
          <p className="mt-2 text-gray-600">
            We take every dispute seriously. Both parties can submit evidence, and our team reviews
            within 24–48 hours.
          </p>
        </div>
        <button
          onClick={() => setActiveView(activeView === 'new' ? 'list' : 'new')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeView === 'new'
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {activeView === 'new' ? 'Back to Disputes' : 'File a Dispute'}
        </button>
      </div>

      {/* Success message */}
      {submitted && (
        <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-green-700">
              Dispute submitted. Our team will review within 24–48 hours. The escrow payment is now
              frozen until resolution.
            </span>
          </div>
        </div>
      )}

      {/* ─── New Dispute Form ─── */}
      {activeView === 'new' && (
        <form onSubmit={handleSubmitDispute} className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">File a New Dispute</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please provide as much detail and evidence as possible. This helps us resolve disputes
              fairly for both parties.
            </p>
          </div>

          {/* Booking ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Booking Reference</label>
            <input
              type="text"
              required
              placeholder="e.g. b3"
              value={newDispute.bookingId}
              onChange={(e) => setNewDispute({ ...newDispute, bookingId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason for Dispute</label>
            <div className="mt-3 space-y-2">
              {DISPUTE_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    newDispute.reason === reason.value
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={newDispute.reason === reason.value}
                    onChange={() => setNewDispute({ ...newDispute, reason: reason.value })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{reason.label}</div>
                    <div className="text-xs text-gray-500">{reason.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">What happened?</label>
            <textarea
              required
              rows={4}
              placeholder="Describe the issue in detail. Include times, specific problems, and any communication you had with the other party..."
              value={newDispute.description}
              onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Evidence upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Evidence</label>
            <p className="mt-1 text-xs text-gray-500">
              Upload photos, videos, or screenshots. Stronger evidence leads to faster resolution.
            </p>

            {evidenceFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {evidenceFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <svg
                        className="h-4 w-4 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
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
                      onClick={() => setEvidenceFiles(evidenceFiles.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-500 hover:text-red-700"
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
              className="mt-3 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 w-full text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition"
            >
              + Upload Photo / Video / Screenshot
            </button>
          </div>

          {/* Fair warning */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h4 className="text-sm font-medium text-amber-800">How disputes work</h4>
            <ul className="mt-2 space-y-1 text-xs text-amber-700">
              <li>&bull; Escrow payment is frozen immediately when a dispute is filed.</li>
              <li>&bull; The other party has 24 hours to respond with their side and evidence.</li>
              <li>&bull; Our team reviews all evidence and resolves within 24–48 hours.</li>
              <li>&bull; Outcomes: full refund, full payment to cleaner, or a fair split.</li>
              <li>&bull; Repeated false disputes may result in account restrictions.</li>
            </ul>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 py-3 text-lg font-semibold text-white hover:bg-red-700"
          >
            Submit Dispute
          </button>
        </form>
      )}

      {/* ─── Dispute List ─── */}
      {activeView === 'list' && (
        <div className="mt-8 space-y-4">
          {disputes.length === 0 && !submitted ? (
            <div className="rounded-lg bg-gray-50 p-8 text-center">
              <p className="text-gray-500">No disputes. That&apos;s great!</p>
            </div>
          ) : (
            disputes.map((dispute) => {
              const statusInfo = getDisputeStatusLabel(dispute.status);
              return (
                <div key={dispute.id} className="rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Dispute #{dispute.id}</h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Filed by {dispute.filedByName} ({dispute.filedBy}) on{' '}
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">Booking: {dispute.bookingId}</div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700">
                      Reason:{' '}
                      <span className="font-normal">
                        {DISPUTE_REASONS.find((r) => r.value === dispute.reason)?.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{dispute.description}</p>
                  </div>

                  {/* Evidence */}
                  {dispute.evidence.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Evidence ({dispute.evidence.length})
                      </h4>
                      <div className="mt-2 space-y-2">
                        {dispute.evidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                  ev.type === 'photo'
                                    ? 'bg-blue-100 text-blue-700'
                                    : ev.type === 'timestamp'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {ev.type}
                              </span>
                              <span className="text-gray-700">{ev.description}</span>
                            </div>
                            <span className="text-xs text-gray-400">by {ev.uploadedBy}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response area (for other party) */}
                  {dispute.status === 'under-review' && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <p className="text-sm text-blue-700">
                        This dispute is under review. You can add additional evidence or information
                        to strengthen your case.
                      </p>
                      <button className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
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
