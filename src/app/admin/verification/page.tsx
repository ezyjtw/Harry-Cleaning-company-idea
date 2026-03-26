'use client';

import { useState } from 'react';

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

// Mock data for the UI — in production, fetched from API
const mockPendingDocs: PendingDocument[] = [
  {
    id: 'doc-001',
    userId: 'usr-101',
    profileId: 'cp-101',
    documentType: 'dbs_certificate',
    originalName: 'dbs_cert_sarah_chen.pdf',
    mimeType: 'application/pdf',
    fileSize: 245760,
    expiresAt: null,
    metadata: { certNumber: '001234567890', issueDate: '2025-08-15' },
    createdAt: '2026-03-24T10:30:00Z',
  },
  {
    id: 'doc-002',
    userId: 'usr-102',
    profileId: 'cp-102',
    documentType: 'right_to_work',
    originalName: 'brp_maria_santos.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1843200,
    expiresAt: '2027-06-15',
    metadata: { docType: 'brp' },
    createdAt: '2026-03-24T11:15:00Z',
  },
  {
    id: 'doc-003',
    userId: 'usr-103',
    profileId: 'cp-103',
    documentType: 'dbs_certificate',
    originalName: 'dbs_ewa_kowalski.pdf',
    mimeType: 'application/pdf',
    fileSize: 189440,
    expiresAt: null,
    metadata: { certNumber: '001234567891', issueDate: '2025-11-20' },
    createdAt: '2026-03-25T09:00:00Z',
  },
  {
    id: 'doc-004',
    userId: 'usr-104',
    profileId: 'cp-104',
    documentType: 'right_to_work',
    originalName: 'visa_priya_sharma.pdf',
    mimeType: 'application/pdf',
    fileSize: 512000,
    expiresAt: '2026-12-01',
    metadata: { docType: 'visa' },
    createdAt: '2026-03-25T14:30:00Z',
  },
  {
    id: 'doc-005',
    userId: 'usr-105',
    profileId: 'cp-105',
    documentType: 'photo_id',
    originalName: 'passport_ana_popescu.jpg',
    mimeType: 'image/jpeg',
    fileSize: 2097152,
    expiresAt: '2030-03-15',
    metadata: { docType: 'passport' },
    createdAt: '2026-03-25T16:00:00Z',
  },
];

const mockExpiringRtw: RtwAlert[] = [
  {
    profileId: 'cp-201',
    userId: 'usr-201',
    cleanerName: 'Priya Sharma',
    email: 'priya@email.com',
    docType: 'visa',
    expiresAt: '2026-04-15',
    daysUntilExpiry: 20,
  },
  {
    profileId: 'cp-202',
    userId: 'usr-202',
    cleanerName: 'Li Wei',
    email: 'li.wei@email.com',
    docType: 'brp',
    expiresAt: '2026-04-25',
    daysUntilExpiry: 30,
  },
];

const mockExpiredRtw: RtwAlert[] = [
  {
    profileId: 'cp-301',
    userId: 'usr-301',
    cleanerName: 'Ahmed Hassan',
    email: 'ahmed@email.com',
    docType: 'eu_pre_settled',
    expiresAt: '2026-03-10',
    daysUntilExpiry: -16,
  },
];

export default function VerificationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [filterType, setFilterType] = useState<DocumentType>('all');
  const [shareCode, setShareCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [shareCodeResult, setShareCodeResult] = useState<ShareCodeResult | null>(null);
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredDocs =
    filterType === 'all'
      ? mockPendingDocs
      : mockPendingDocs.filter((d) => d.documentType === filterType);

  const handleVerify = async (docId: string, approved: boolean) => {
    setVerifyingDoc(docId);
    // In production: await fetch('/api/admin/documents', { method: 'PATCH', body: ... })
    await new Promise((r) => setTimeout(r, 800));
    setVerifyingDoc(null);
    setStatusMessage(`Document ${docId} ${approved ? 'approved' : 'rejected'}`);
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
    // In production: await fetch('/api/admin/rtw', { method: 'POST', body: ... })
    setStatusMessage(`Cleaner ${profileId} suspended due to expired RTW`);
  };

  const handleSendAlerts = async () => {
    // In production: await fetch('/api/admin/rtw', { method: 'POST', body: ... })
    setStatusMessage('Expiry alert emails sent to all cleaners with expiring RTW documents');
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending Verification', count: mockPendingDocs.length },
    { id: 'expiring_rtw', label: 'Expiring RTW', count: mockExpiringRtw.length },
    { id: 'expired_rtw', label: 'Expired RTW', count: mockExpiredRtw.length },
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

      {/* Pending Verification Tab */}
      {activeTab === 'pending' && (
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
                {filteredDocs.map((doc) => (
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
            {filteredDocs.length === 0 && (
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
      {activeTab === 'expiring_rtw' && (
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
            {mockExpiringRtw.map((alert) => (
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
            {mockExpiringRtw.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
                <p>No RTW documents expiring within 90 days</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expired RTW Tab */}
      {activeTab === 'expired_rtw' && (
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
            {mockExpiredRtw.map((alert) => (
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
            {mockExpiredRtw.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
                <p>No cleaners with expired RTW documents</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Code Check Tab */}
      {activeTab === 'share_code' && (
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
