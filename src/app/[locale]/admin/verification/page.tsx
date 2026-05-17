'use client';

import { useState, useEffect, useCallback } from 'react';

type DocumentType = 'all' | 'dbs_certificate' | 'right_to_work' | 'photo_id';
type Tab = 'pending' | 'expiring_rtw' | 'expired_rtw' | 'share_code';

interface PendingDocument {
  id: string;
  userId: string;
  profileId: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [filterType, setFilterType] = useState<DocumentType>('all');
  const [shareCode, setShareCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [shareCodeResult, setShareCodeResult] = useState<ShareCodeResult | null>(null);
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live data from API
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [expiringRtw, setExpiringRtw] = useState<RtwAlert[]>([]);
  const [expiredRtw, setExpiredRtw] = useState<RtwAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingDocs = useCallback(async () => {
    try {
      const typeParam = filterType !== 'all' ? `?type=${filterType}` : '';
      const res = await fetch(`/api/admin/documents${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setPendingDocs(data.documents || []);
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch pending documents');
    }
  }, [filterType]);

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
    Promise.all([fetchPendingDocs(), fetchRtwData()]).finally(() => setLoading(false));
  }, [fetchPendingDocs, fetchRtwData]);

  // Refetch pending docs when filter changes
  useEffect(() => {
    fetchPendingDocs();
  }, [filterType, fetchPendingDocs]);

  const handleVerify = async (docId: string, approved: boolean) => {
    setVerifyingDoc(docId);
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, adminId: 'admin-001', approved }),
      });
      if (res.ok) {
        setStatusMessage(`Document ${approved ? 'approved' : 'rejected'} successfully`);
        // Remove from list
        setPendingDocs((prev) => prev.filter((d) => d.id !== docId));
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
    { id: 'pending', label: 'Pending Verification', count: pendingDocs.length },
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

  const docTypeBadge: Record<string, string> = {
    dbs_certificate: 'bg-purple-100 text-purple-700',
    right_to_work: 'bg-blue-100 text-blue-700',
    photo_id: 'bg-green-100 text-green-700',
    insurance: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {statusMessage && (
        <div className="mb-4 rounded bg-green-50 border border-green-200 px-4 py-3 text-green-800 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-green-600 hover:text-green-800 font-bold"
          >
            ×
          </button>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-gray-500 mt-1">
          Review, verify, and manage DBS certificates and Right to Work documents
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
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
        <div className="text-center py-12 text-gray-400">
          <p>Loading verification data...</p>
        </div>
      )}

      {/* Pending Verification Tab */}
      {!loading && activeTab === 'pending' && (
        <div>
          {/* Filter */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocumentType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All Documents</option>
              <option value="dbs_certificate">DBS Certificates</option>
              <option value="right_to_work">Right to Work</option>
              <option value="photo_id">Photo ID</option>
            </select>
            <button
              onClick={() => fetchPendingDocs()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {/* Documents table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Document
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                    Details
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                    Uploaded
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.originalName}</p>
                          <p className="text-xs text-gray-400">
                            {(doc.fileSize / 1024).toFixed(0)} KB &middot; {doc.mimeType}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${docTypeBadge[doc.documentType] || ''}`}
                      >
                        {docTypeLabel[doc.documentType] || doc.documentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {doc.metadata &&
                        Object.entries(doc.metadata).map(([key, value]) => (
                          <span key={key} className="block text-xs">
                            <span className="text-gray-400">{key}:</span> {String(value)}
                          </span>
                        ))}
                      {doc.expiresAt && (
                        <span className="block text-xs text-orange-600">
                          Expires: {new Date(doc.expiresAt).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {new Date(doc.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={verifyingDoc === doc.id}
                          onClick={() => handleVerify(doc.id, true)}
                          className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {verifyingDoc === doc.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          disabled={verifyingDoc === doc.id}
                          onClick={() => handleVerify(doc.id, false)}
                          className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingDocs.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>No documents pending verification</p>
              </div>
            )}
          </div>

          {/* Encryption notice */}
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">Documents are encrypted at rest</p>
                <p className="text-xs text-blue-600 mt-1">
                  All documents are encrypted using AES-256-GCM with unique per-document keys.
                  Access is logged in the audit trail. DBS certificates are automatically destroyed
                  6 months after verification. RTW documents are retained per Home Office guidance
                  (engagement + 2 years).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expiring RTW Tab */}
      {!loading && activeTab === 'expiring_rtw' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Cleaners with right to work documents expiring within 90 days
            </p>
            <button
              onClick={handleSendAlerts}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Send All Expiry Alerts
            </button>
          </div>

          <div className="space-y-3">
            {expiringRtw.map((alert) => (
              <div
                key={alert.profileId}
                className="bg-white rounded-xl border border-yellow-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-yellow-600"
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
                    <p className="text-sm font-medium text-gray-900">{alert.cleanerName}</p>
                    <p className="text-xs text-gray-400">{alert.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                    {alert.daysUntilExpiry} days remaining
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {alert.docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} —
                    Expires {new Date(alert.expiresAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            ))}
            {expiringRtw.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
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
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-medium text-red-800">
                These cleaners have expired right to work documents and should be suspended from
                accepting new bookings until updated documentation is provided.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {expiredRtw.map((alert) => (
              <div
                key={alert.profileId}
                className="bg-white rounded-xl border border-red-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-red-600"
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
                    <p className="text-sm font-medium text-gray-900">{alert.cleanerName}</p>
                    <p className="text-xs text-gray-400">{alert.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      Expired {Math.abs(alert.daysUntilExpiry)} days ago
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {alert.docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSuspend(alert.profileId)}
                    className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Suspend Cleaner
                  </button>
                </div>
              </div>
            ))}
            {expiredRtw.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
                <p>No cleaners with expired RTW documents</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Code Check Tab */}
      {!loading && activeTab === 'share_code' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Home Office Share Code Verification
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Verify a cleaner&apos;s right to work via the Home Office Employer Checking Service
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Share Code</label>
                <input
                  type="text"
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4E"
                  maxLength={9}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono tracking-wider"
                />
                <p className="text-xs text-gray-400 mt-1">
                  9-character alphanumeric code from{' '}
                  <a
                    href="https://www.gov.uk/prove-right-to-work"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    gov.uk/prove-right-to-work
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
                />
              </div>

              <button
                onClick={handleShareCodeCheck}
                disabled={shareCodeLoading || !shareCode || !dateOfBirth}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shareCodeLoading ? 'Verifying...' : 'Verify Share Code'}
              </button>
            </div>

            {/* Result */}
            {shareCodeResult && (
              <div
                className={`mt-6 rounded-lg p-4 ${
                  shareCodeResult.valid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      shareCodeResult.valid ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {shareCodeResult.valid ? (
                      <svg
                        className="w-5 h-5 text-green-600"
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
                        className="w-5 h-5 text-red-600"
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
                        shareCodeResult.valid ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {shareCodeResult.valid
                        ? 'Right to Work Confirmed'
                        : `Verification Failed: ${shareCodeResult.status}`}
                    </p>
                    {shareCodeResult.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">{shareCodeResult.errorMessage}</p>
                    )}
                    {shareCodeResult.fullName && (
                      <p className="text-xs text-green-600 mt-1">
                        Name: {shareCodeResult.fullName}
                      </p>
                    )}
                    {shareCodeResult.immigrationStatus && (
                      <p className="text-xs text-green-600">
                        Status: {shareCodeResult.immigrationStatus}
                      </p>
                    )}
                    {shareCodeResult.expiresAt && (
                      <p className="text-xs text-green-600">
                        Expires: {new Date(shareCodeResult.expiresAt).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs text-gray-500">
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
