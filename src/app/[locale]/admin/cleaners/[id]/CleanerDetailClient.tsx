'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { CleanerDetail, CleanerDocument } from './page';

const docTypeLabel: Record<string, string> = {
  dbs_certificate: 'DBS Certificate',
  right_to_work: 'Right to Work',
  photo_id: 'Photo ID',
  insurance: 'Insurance',
  selfie: 'Selfie',
};

const docTypeBadge: Record<string, string> = {
  dbs_certificate: 'bg-purple-100 text-purple-700',
  right_to_work: 'bg-blue-100 text-blue-700',
  photo_id: 'bg-green-100 text-green-700',
  insurance: 'bg-orange-100 text-orange-700',
  selfie: 'bg-pink-100 text-pink-700',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CleanerDetailClient({ cleaner }: { cleaner: CleanerDetail }) {
  const [verificationStatus, setVerificationStatus] = useState(cleaner.verificationStatus);
  const [verified, setVerified] = useState(cleaner.verified);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const selfieDoc = cleaner.documents.find((d) => d.documentType === 'selfie');
  const photoIdDoc = cleaner.documents.find((d) => d.documentType === 'photo_id');
  const otherDocs = cleaner.documents.filter((d) => d.documentType !== 'selfie');

  const handleVerify = async () => {
    setProcessing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/cleaners/${cleaner.userId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY' }),
      });
      if (res.ok) {
        setVerified(true);
        setVerificationStatus('VERIFIED');
        setStatusMessage({ type: 'success', text: 'Cleaner verified. Approval email sent.' });
      } else {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || 'Failed to verify cleaner.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setProcessing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/cleaners/${cleaner.userId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectReason.trim() }),
      });
      if (res.ok) {
        setVerified(false);
        setVerificationStatus('REJECTED');
        setShowRejectForm(false);
        setRejectReason('');
        setStatusMessage({ type: 'success', text: 'Cleaner rejected. Rejection email sent.' });
      } else {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || 'Failed to reject cleaner.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setProcessing(false);
    }
  };

  const openDocument = (docId: string) => {
    window.open(`/api/admin/documents/${docId}/download`, '_blank', 'noopener,noreferrer');
  };

  const verificationBadge = () => {
    const styles: Record<string, string> = {
      VERIFIED: 'bg-green-100 text-green-800 border-green-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${styles[verificationStatus] || styles.PENDING}`}
      >
        {verificationStatus}
      </span>
    );
  };

  const renderDocRow = (doc: CleanerDocument) => (
    <tr key={doc.id} className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${docTypeBadge[doc.documentType] || 'bg-gray-100 text-gray-700'}`}
        >
          {docTypeLabel[doc.documentType] || doc.documentType}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">{doc.originalName}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatBytes(doc.fileSize)}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.createdAt)}</td>
      <td className="px-4 py-3">
        {doc.isVerified ? (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Verified
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            Pending
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => openDocument(doc.id)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          View
        </button>
      </td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/cleaners"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to cleaners
      </Link>

      {statusMessage && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cleaner.name}</h1>
          <p className="text-gray-500">{cleaner.email}</p>
          {cleaner.phone && <p className="text-gray-400 text-sm">{cleaner.phone}</p>}
        </div>
        <div className="flex items-center gap-3">
          {verificationBadge()}
          {verified && (
            <svg
              className="w-6 h-6 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Postcode</dt>
            <dd className="font-medium text-gray-900">{cleaner.postcode || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Area</dt>
            <dd className="font-medium text-gray-900">{cleaner.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Signed up</dt>
            <dd className="font-medium text-gray-900">{formatDate(cleaner.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Tier</dt>
            <dd className="font-medium text-gray-900 capitalize">{cleaner.tier.toLowerCase()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Completed jobs</dt>
            <dd className="font-medium text-gray-900">{cleaner.completedJobs}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Rating</dt>
            <dd className="font-medium text-gray-900">
              {cleaner.rating > 0 ? cleaner.rating.toFixed(1) : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Travel radius</dt>
            <dd className="font-medium text-gray-900">{cleaner.radius} miles</dd>
          </div>
          <div>
            <dt className="text-gray-500">Travel mode</dt>
            <dd className="font-medium text-gray-900 capitalize">
              {cleaner.travelMode?.replace(/_/g, ' ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Experience</dt>
            <dd className="font-medium text-gray-900">
              {cleaner.yearsExperience !== null ? `${cleaner.yearsExperience} years` : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bio & Services */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        {cleaner.bio && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Bio</h3>
            <p className="text-sm text-gray-900">{cleaner.bio}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="text-gray-500 mb-1">Hourly rate</h3>
            <p className="font-medium text-gray-900">&pound;{cleaner.hourlyRate.toFixed(2)}</p>
          </div>
          <div>
            <h3 className="text-gray-500 mb-1">Hours/week</h3>
            <p className="font-medium text-gray-900">{cleaner.hoursPerWeek ?? '—'}</p>
          </div>
          {cleaner.specialties.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-gray-500 mb-1">Specialties</h3>
              <div className="flex flex-wrap gap-1">
                {cleaner.specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cleaner.serviceTypes.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-gray-500 mb-1">Service types</h3>
              <div className="flex flex-wrap gap-1">
                {cleaner.serviceTypes.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cleaner.languages.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-gray-500 mb-1">Languages</h3>
              <p className="font-medium text-gray-900">{cleaner.languages.join(', ')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Background check</dt>
            <dd
              className={`font-medium ${cleaner.backgroundCheckPassed ? 'text-green-700' : 'text-gray-400'}`}
            >
              {cleaner.backgroundCheckPassed ? 'Passed' : 'Not completed'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">DBS cert</dt>
            <dd
              className={`font-medium ${cleaner.dbsCertVerified ? 'text-green-700' : 'text-gray-400'}`}
            >
              {cleaner.dbsCertNumber || '—'}
              {cleaner.dbsCertVerified && ' (verified)'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Identity verified</dt>
            <dd
              className={`font-medium ${cleaner.identityVerifiedAt ? 'text-green-700' : 'text-gray-400'}`}
            >
              {cleaner.identityVerifiedAt ? formatDate(cleaner.identityVerifiedAt) : 'No'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Insurance</dt>
            <dd
              className={`font-medium ${cleaner.insuranceVerified ? 'text-green-700' : 'text-gray-400'}`}
            >
              {cleaner.insuranceVerified ? 'Verified' : 'Not verified'}
              {cleaner.insuranceExpiresAt && ` (exp. ${formatDate(cleaner.insuranceExpiresAt)})`}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Right to work</dt>
            <dd className="font-medium text-gray-900">
              {cleaner.rightToWorkStatus || '—'}
              {cleaner.rightToWorkDocType && ` (${cleaner.rightToWorkDocType})`}
            </dd>
          </div>
          {cleaner.rightToWorkExpiresAt && (
            <div>
              <dt className="text-gray-500">RTW expires</dt>
              <dd className="font-medium text-gray-900">
                {formatDate(cleaner.rightToWorkExpiresAt)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Selfie + Photo ID side-by-side */}
      {(selfieDoc || photoIdDoc) && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Identity Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-gray-500 mb-2">Selfie</p>
              {selfieDoc ? (
                <button
                  onClick={() => openDocument(selfieDoc.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Selfie
                </button>
              ) : (
                <p className="text-sm text-gray-400">Not uploaded</p>
              )}
              {selfieDoc && (
                <p className="text-xs text-gray-400 mt-2">
                  Uploaded {formatDate(selfieDoc.createdAt)} &middot;{' '}
                  {formatBytes(selfieDoc.fileSize)}
                </p>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-gray-500 mb-2">Photo ID</p>
              {photoIdDoc ? (
                <button
                  onClick={() => openDocument(photoIdDoc.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Photo ID
                </button>
              ) : (
                <p className="text-sm text-gray-400">Not uploaded</p>
              )}
              {photoIdDoc && (
                <p className="text-xs text-gray-400 mt-2">
                  Uploaded {formatDate(photoIdDoc.createdAt)} &middot;{' '}
                  {formatBytes(photoIdDoc.fileSize)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Documents */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Documents ({cleaner.documents.length})
        </h2>
        {otherDocs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                    Uploaded
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">{otherDocs.map(renderDocRow)}</tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No documents uploaded.</p>
        )}
      </section>

      {/* Verification Actions */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Actions</h2>

        {verificationStatus === 'REJECTED' &&
          typeof cleaner.verificationMeta?.rejectionReason === 'string' && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-medium text-red-800">Previous rejection reason:</p>
              <p className="text-sm text-red-700 mt-1">
                &ldquo;{String(cleaner.verificationMeta.rejectionReason)}&rdquo;
              </p>
            </div>
          )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={processing || verified}
              className="inline-flex items-center rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Verify Cleaner'}
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={processing}
              className="inline-flex items-center rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Cleaner
            </button>
          </div>

          {showRejectForm && (
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                This reason will be shown to the cleaner in their rejection email. Be professional
                and factual.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Rejection reason (required, max 500 characters)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{rejectReason.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectReason('');
                    }}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing || !rejectReason.trim()}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
