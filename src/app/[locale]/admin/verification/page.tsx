'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'queue' | 'expiring_rtw' | 'expired_rtw' | 'share_code';
type QueueFilter = 'all' | 'review' | 'insurance' | 'waiting';

interface QueueDocument {
  id: string;
  profileId: string | null;
  documentType: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isVerified: boolean;
  expiresAt: string | null;
  createdAt: string;
}

// The queue's unit is the CLEANER (James, from live testing) — documents roll
// up under each cleaner with outstanding-vs-submitted visible at a glance.
interface QueueCleaner {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  appliedAt: string;
  verified: boolean;
  verificationStatus: string;
  documents: QueueDocument[];
  docStates: Record<string, { submitted: boolean; verified: boolean; rejected: boolean }>;
  missing: string[];
  pendingReview: number;
  readyForReview: boolean;
  identityReview: boolean;
  insuranceReview: boolean;
  needsReview: boolean;
  // Stage 2 rollup — never blocks identity verification.
  goLive: { insurance: 'approved' | 'submitted' | 'rejected' | 'missing'; stripe: boolean; live: boolean };
}

interface RtwAlert {
  profileId: string;
  userId: string;
  cleanerName: string;
  email: string;
  docType: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

interface ShareCodeResult {
  valid: boolean;
  status: string;
  rightToWork?: boolean;
  expiresAt?: string;
  fullName?: string;
  immigrationStatus?: string;
  errorMessage?: string;
}

export default function VerificationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activating, setActivating] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [shareCodeResult, setShareCodeResult] = useState<ShareCodeResult | null>(null);
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live data from API
  const [queue, setQueue] = useState<QueueCleaner[]>([]);
  const [expiringRtw, setExpiringRtw] = useState<RtwAlert[]>([]);
  const [expiredRtw, setExpiredRtw] = useState<RtwAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verification-queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data.cleaners || []);
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch verification queue');
    }
  }, []);

  const fetchRtwData = useCallback(async () => {
    try {
      const [expiringRes, expiredRes] = await Promise.all([
        fetch('/api/admin/rtw?action=expiring&days=90'),
        fetch('/api/admin/rtw?action=expired'),
      ]);

      if (expiringRes.ok) {
        const data = await expiringRes.json();
        setExpiringRtw(
          (data.expiring || []).map((item: Record<string, unknown>) => ({
            profileId: item.profileId || item.id,
            userId: item.userId,
            cleanerName: item.cleanerName || item.name,
            email: item.email,
            docType: item.docType || item.rightToWorkDocType,
            expiresAt: item.expiresAt || item.rightToWorkExpiresAt,
            daysUntilExpiry:
              item.daysUntilExpiry ||
              Math.ceil((new Date(item.expiresAt as string).getTime() - Date.now()) / 86400000),
          }))
        );
      }

      if (expiredRes.ok) {
        const data = await expiredRes.json();
        setExpiredRtw(
          (data.expired || []).map((item: Record<string, unknown>) => ({
            profileId: item.profileId || item.id,
            userId: item.userId,
            cleanerName: item.cleanerName || item.name,
            email: item.email,
            docType: item.docType || item.rightToWorkDocType,
            expiresAt: item.expiresAt || item.rightToWorkExpiresAt,
            daysUntilExpiry:
              item.daysUntilExpiry ||
              Math.ceil((new Date(item.expiresAt as string).getTime() - Date.now()) / 86400000),
          }))
        );
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch RTW data');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchQueue(), fetchRtwData()]).finally(() => setLoading(false));
  }, [fetchQueue, fetchRtwData]);

  const handleVerify = async (docId: string, approved: boolean, reason?: string) => {
    setVerifyingDoc(docId);
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, approved, ...(reason ? { reason } : {}) }),
      });
      if (res.ok) {
        setStatusMessage(`Document ${approved ? 'approved' : 'rejected'} successfully`);
        setRejectingDocId(null);
        setRejectReason('');
        await fetchQueue();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.error || 'Failed to process document'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server');
    } finally {
      setVerifyingDoc(null);
    }
  };

  // Overall verify/activate — the existing admin route, unchanged machinery.
  const handleActivate = async (userId: string) => {
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/cleaners/${userId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage('Identity verified. The cleaner goes live once insurance and payouts are green.');
        setSelectedId(null);
        await fetchQueue();
      } else {
        setStatusMessage(`Error: ${data?.error || 'Failed to verify cleaner'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server');
    } finally {
      setActivating(false);
    }
  };

  const handleShareCodeCheck = async () => {
    if (!shareCode || !dateOfBirth) return;
    setShareCodeLoading(true);

    try {
      const res = await fetch('/api/admin/rtw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_share_code',
          shareCode,
          dateOfBirth,
          adminId: 'admin-001',
        }),
      });
      const data = await res.json();
      setShareCodeResult(data.result);
    } catch {
      setShareCodeResult({
        valid: false,
        status: 'error',
        errorMessage: 'Failed to connect to verification service',
      });
    } finally {
      setShareCodeLoading(false);
    }
  };

  const handleSuspend = async (profileId: string) => {
    try {
      const res = await fetch('/api/admin/rtw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend_expired',
          profileId,
          adminId: 'admin-001',
        }),
      });
      if (res.ok) {
        setStatusMessage(`Cleaner suspended due to expired RTW`);
        setExpiredRtw((prev) => prev.filter((a) => a.profileId !== profileId));
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.error || 'Failed to suspend cleaner'}`);
      }
    } catch {
      setStatusMessage('Network error — could not reach the server');
    }
  };

  const handleSendAlerts = async () => {
    try {
      const res = await fetch('/api/admin/rtw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_expiry_alerts',
          adminId: 'admin-001',
          days: 90,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(data.message || 'Expiry alerts sent successfully');
      } else {
        setStatusMessage('Failed to send expiry alerts');
      }
    } catch {
      setStatusMessage('Network error — could not reach the server');
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'queue', label: 'Verification Queue', count: queue.length },
    { id: 'expiring_rtw', label: 'Expiring RTW', count: expiringRtw.length },
    { id: 'expired_rtw', label: 'Expired RTW', count: expiredRtw.length },
    { id: 'share_code', label: 'Share Code Check' },
  ];

  const docTypeLabel: Record<string, string> = {
    dbs_certificate: 'DBS Certificate',
    right_to_work: 'Right to Work',
    photo_id: 'Photo ID',
    insurance: 'Insurance',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {statusMessage && (
        <div className="mb-4 rounded bg-trust/10 border border-trust/20 px-4 py-3 text-trust flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-trust hover:text-trust font-bold"
          >
            ×
          </button>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Document Verification</h1>
        <p className="text-ink-3 mt-1">
          Review, verify, and manage DBS certificates and Right to Work documents
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink-2'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    activeTab === tab.id ? 'bg-primary-soft text-primary' : 'bg-page text-ink-2'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading && (
        <div className="text-center py-12 text-ink-3">
          <p>Loading verification data...</p>
        </div>
      )}

      {/* Verification Queue — per-cleaner (James-ruled restructure) */}
      {!loading && activeTab === 'queue' && (
        <div>
          {/* Filter chips */}
          <div className="mb-4 flex items-center gap-2">
            {(
              [
                ['all', 'All'],
                ['review', 'Needs review'],
                ['insurance', 'Insurance review'],
                ['waiting', 'Waiting on cleaner'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setQueueFilter(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  queueFilter === value
                    ? 'bg-primary text-white'
                    : 'border border-line bg-surface text-ink-2 hover:bg-page'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => fetchQueue()}
              className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-ink-2 hover:bg-page"
            >
              Refresh
            </button>
          </div>

          {/* Cleaner cards, newest first */}
          <div className="space-y-3">
            {queue
              .filter((c) =>
                queueFilter === 'review'
                  ? c.needsReview
                  : queueFilter === 'insurance'
                    ? c.insuranceReview
                    : queueFilter === 'waiting'
                      ? !c.needsReview && !c.goLive.live
                      : true
              )
              .map((c) => {
                const isOpen = selectedId === c.profileId;
                return (
                  <div key={c.profileId} className="rounded-xl border border-line bg-surface">
                    {/* Card row */}
                    <button
                      type="button"
                      onClick={() => setSelectedId(isOpen ? null : c.profileId)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-page"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-ink-3">
                          {c.email} · applied{' '}
                          {new Date(c.appliedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {/* Stage 1 — identity chips (ID + RTW; DBS optional) */}
                        {(['photo_id', 'right_to_work', 'dbs_certificate'] as const).map((t) => {
                          const st = c.docStates[t];
                          if (!st && t === 'dbs_certificate') return null; // optional — only show when present
                          const cls = st?.verified
                            ? 'bg-trust/10 text-trust'
                            : st?.rejected
                              ? 'bg-danger/10 text-danger'
                              : st?.submitted
                                ? 'bg-orange-100 text-orange-700'
                                : 'border border-line bg-page text-ink-3';
                          const suffix = st?.verified
                            ? ' ✓'
                            : st?.rejected
                              ? ' · rejected'
                              : st?.submitted
                                ? ' · review'
                                : ' · missing';
                          return (
                            <span
                              key={t}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
                            >
                              {docTypeLabel[t]}
                              {suffix}
                            </span>
                          );
                        })}
                        {/* Stage 2 — GO-LIVE chips (visible, never block verification) */}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            c.goLive.insurance === 'approved'
                              ? 'border-trust/30 bg-trust/5 text-trust'
                              : c.goLive.insurance === 'rejected'
                                ? 'border-danger/30 bg-danger/5 text-danger'
                                : c.goLive.insurance === 'submitted'
                                  ? 'border-orange-200 bg-orange-50 text-orange-700'
                                  : 'border-line bg-page text-ink-3'
                          }`}
                        >
                          Go-live: Insurance
                          {c.goLive.insurance === 'approved'
                            ? ' ✓'
                            : c.goLive.insurance === 'rejected'
                              ? ' · rejected'
                              : c.goLive.insurance === 'submitted'
                                ? ' · review'
                                : ' · missing'}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            c.goLive.stripe
                              ? 'border-trust/30 bg-trust/5 text-trust'
                              : 'border-line bg-page text-ink-3'
                          }`}
                        >
                          Go-live: Payouts{c.goLive.stripe ? ' ✓' : ' · not set up'}
                        </span>
                        <span
                          className={`ml-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            c.goLive.live
                              ? 'bg-trust text-white'
                              : c.insuranceReview
                                ? 'bg-primary text-white'
                                : c.verified
                                  ? 'bg-primary-soft text-primary'
                                  : c.readyForReview
                                    ? 'bg-primary text-white'
                                    : 'bg-page text-ink-3'
                          }`}
                        >
                          {c.goLive.live
                            ? 'Live'
                            : c.insuranceReview
                              ? 'Insurance to review'
                              : c.verified
                                ? 'Verified — go-live pending'
                                : c.readyForReview
                                  ? 'Ready for review'
                                  : 'Waiting on cleaner'}
                        </span>
                      </div>
                    </button>

                    {/* Dossier — all documents together, per-doc actions, overall activate */}
                    {isOpen && (
                      <div className="border-t border-line px-5 py-4">
                        {c.documents.length === 0 ? (
                          <p className="py-2 text-sm text-ink-3">No documents uploaded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {c.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex flex-col gap-2 rounded-lg border border-line bg-page px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink">
                                    {docTypeLabel[doc.documentType] || doc.documentType}
                                    {doc.isVerified && <span className="ml-2 text-trust">✓ verified</span>}
                                  </p>
                                  <p className="text-xs text-ink-3">
                                    {doc.originalName} · {(doc.fileSize / 1024).toFixed(0)} KB ·{' '}
                                    {new Date(doc.createdAt).toLocaleDateString('en-GB')}
                                    {doc.expiresAt &&
                                      ` · expires ${new Date(doc.expiresAt).toLocaleDateString('en-GB')}`}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <a
                                    href={`/api/admin/documents/${doc.id}/download`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-page"
                                  >
                                    View
                                  </a>
                                  {!doc.isVerified && (
                                    <>
                                      <button
                                        disabled={verifyingDoc === doc.id}
                                        onClick={() => handleVerify(doc.id, true)}
                                        className="rounded-lg bg-trust px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                      >
                                        {verifyingDoc === doc.id ? 'Processing…' : 'Approve'}
                                      </button>
                                      <button
                                        disabled={verifyingDoc === doc.id}
                                        onClick={() => {
                                          setRejectingDocId(doc.id);
                                          setRejectReason('');
                                        }}
                                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                                {rejectingDocId === doc.id && (
                                  <div className="flex w-full items-center gap-2 sm:basis-full">
                                    <input
                                      autoFocus
                                      value={rejectReason}
                                      onChange={(e) => setRejectReason(e.target.value)}
                                      placeholder="Reason (sent to the audit log)"
                                      className="flex-1 rounded-lg border border-line px-3 py-2 text-sm"
                                    />
                                    <button
                                      disabled={!rejectReason.trim() || verifyingDoc === doc.id}
                                      onClick={() => handleVerify(doc.id, false, rejectReason.trim())}
                                      className="rounded-lg bg-danger px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                                    >
                                      Confirm reject
                                    </button>
                                    <button
                                      onClick={() => setRejectingDocId(null)}
                                      className="rounded-lg border border-line px-3 py-2 text-xs text-ink-2"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stage 1 action — identity only (ID + RTW verified).
                            Insurance NEVER blocks this; it's a go-live item. */}
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-xs text-ink-3">
                            {c.missing.length > 0
                              ? `Identity — waiting on: ${c.missing.map((m) => docTypeLabel[m] || m).join(', ')}`
                              : !(c.docStates['photo_id']?.verified && c.docStates['right_to_work']?.verified)
                                ? 'Identity documents awaiting your review'
                                : c.verified
                                  ? c.goLive.live
                                    ? 'Live — identity, insurance and payouts all green'
                                    : `Verified — go-live waiting on: ${[
                                        c.goLive.insurance !== 'approved'
                                          ? c.goLive.insurance === 'submitted'
                                            ? 'insurance approval (in your dossier below)'
                                            : 'insurance upload'
                                          : null,
                                        !c.goLive.stripe ? 'Stripe payouts' : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' + ')}`
                                  : 'Identity verified documents — ready to verify'}
                          </p>
                          {!c.verified && (
                            <button
                              disabled={
                                activating ||
                                !(
                                  c.docStates['photo_id']?.verified &&
                                  c.docStates['right_to_work']?.verified
                                )
                              }
                              onClick={() => handleActivate(c.userId)}
                              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                              title="Enabled once Photo ID and Right to Work are both approved — insurance never blocks identity verification"
                            >
                              {activating ? 'Verifying…' : 'Verify identity'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {queue.length === 0 && (
            <div className="rounded-xl border border-line bg-surface py-12 text-center text-ink-3">
              <p>No cleaners awaiting verification</p>
            </div>
          )}

          {/* Encryption notice (unchanged) */}
          <div className="mt-4 rounded-lg bg-primary-soft border border-primary/20 p-4">
            <p className="text-sm font-medium text-primary">Documents are encrypted at rest</p>
            <p className="text-xs text-primary mt-1">
              All documents are encrypted using AES-256-GCM with unique per-document keys. Access
              is logged in the audit trail. DBS certificates are automatically destroyed 6 months
              after verification. RTW documents are retained per Home Office guidance (engagement
              + 2 years).
            </p>
          </div>
        </div>
      )}

      {/* Expiring RTW Tab */}
      {!loading && activeTab === 'expiring_rtw' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-ink-2">
              Cleaners with right to work documents expiring within 90 days
            </p>
            <button
              onClick={handleSendAlerts}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Send All Expiry Alerts
            </button>
          </div>

          <div className="space-y-3">
            {expiringRtw.map((alert) => (
              <div
                key={alert.profileId}
                className="bg-surface rounded-xl border border-warning/20 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-warning"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{alert.cleanerName}</p>
                    <p className="text-xs text-ink-3">{alert.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                    {alert.daysUntilExpiry} days remaining
                  </span>
                  <p className="text-xs text-ink-3 mt-1">
                    {alert.docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} —
                    Expires {new Date(alert.expiresAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            ))}
            {expiringRtw.length === 0 && (
              <div className="text-center py-12 text-ink-3 bg-surface rounded-xl border">
                <p>No RTW documents expiring within 90 days</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expired RTW Tab */}
      {!loading && activeTab === 'expired_rtw' && (
        <div>
          <div className="mb-4">
            <div className="rounded-lg bg-danger/10 border border-danger/20 p-4">
              <p className="text-sm font-medium text-danger">
                These cleaners have expired right to work documents and should be suspended from
                accepting new bookings until updated documentation is provided.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {expiredRtw.map((alert) => (
              <div
                key={alert.profileId}
                className="bg-surface rounded-xl border border-danger/20 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-danger"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{alert.cleanerName}</p>
                    <p className="text-xs text-ink-3">{alert.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="inline-flex rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                      Expired {Math.abs(alert.daysUntilExpiry)} days ago
                    </span>
                    <p className="text-xs text-ink-3 mt-1">
                      {alert.docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSuspend(alert.profileId)}
                    className="inline-flex items-center rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger"
                  >
                    Suspend Cleaner
                  </button>
                </div>
              </div>
            ))}
            {expiredRtw.length === 0 && (
              <div className="text-center py-12 text-ink-3 bg-surface rounded-xl border">
                <p>No cleaners with expired RTW documents</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Code Check Tab */}
      {!loading && activeTab === 'share_code' && (
        <div className="max-w-xl">
          <div className="bg-surface rounded-xl border border-line p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">
              Home Office Share Code Verification
            </h2>
            <p className="text-sm text-ink-3 mb-6">
              Verify a cleaner&apos;s right to work via the Home Office Employer Checking Service
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Share Code</label>
                <input
                  type="text"
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4E"
                  maxLength={9}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-mono tracking-wider"
                />
                <p className="text-xs text-ink-3 mt-1">
                  9-character alphanumeric code from{' '}
                  <a
                    href="https://www.gov.uk/prove-right-to-work"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    gov.uk/prove-right-to-work
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-2.5 text-sm"
                />
              </div>

              <button
                onClick={handleShareCodeCheck}
                disabled={shareCodeLoading || !shareCode || !dateOfBirth}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shareCodeLoading ? 'Verifying...' : 'Verify Share Code'}
              </button>
            </div>

            {/* Result */}
            {shareCodeResult && (
              <div
                className={`mt-6 rounded-lg p-4 ${
                  shareCodeResult.valid
                    ? 'bg-trust/10 border border-trust/20'
                    : 'bg-danger/10 border border-danger/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      shareCodeResult.valid ? 'bg-trust/10' : 'bg-danger/10'
                    }`}
                  >
                    {shareCodeResult.valid ? (
                      <svg
                        className="w-5 h-5 text-trust"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-danger"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        shareCodeResult.valid ? 'text-trust' : 'text-danger'
                      }`}
                    >
                      {shareCodeResult.valid
                        ? 'Right to Work Confirmed'
                        : `Verification Failed: ${shareCodeResult.status}`}
                    </p>
                    {shareCodeResult.errorMessage && (
                      <p className="text-xs text-danger mt-1">{shareCodeResult.errorMessage}</p>
                    )}
                    {shareCodeResult.fullName && (
                      <p className="text-xs text-trust mt-1">Name: {shareCodeResult.fullName}</p>
                    )}
                    {shareCodeResult.immigrationStatus && (
                      <p className="text-xs text-trust">
                        Status: {shareCodeResult.immigrationStatus}
                      </p>
                    )}
                    {shareCodeResult.expiresAt && (
                      <p className="text-xs text-trust">
                        Expires: {new Date(shareCodeResult.expiresAt).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-page border border-line p-4">
            <p className="text-xs text-ink-3">
              <strong>Audit Trail:</strong> All share code verifications are logged in the audit
              system, including the requesting admin, timestamp, and result. Share codes are
              partially redacted in logs for data protection compliance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
