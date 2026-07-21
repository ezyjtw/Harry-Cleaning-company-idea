'use client';

import Link from 'next/link';
import { useState } from 'react';

import CleanerAvatar from '@/components/CleanerAvatar';

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
  right_to_work: 'bg-primary-soft text-primary',
  photo_id: 'bg-trust/10 text-trust',
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
  // F-B: admin-settable permanent founding badge.
  const [founding, setFounding] = useState(cleaner.foundingCleaner);
  const [foundingBusy, setFoundingBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  // P7: admin-side imported-review form state.
  const [importSource, setImportSource] = useState('');
  const [importRating, setImportRating] = useState('');
  const [importReviewer, setImportReviewer] = useState('');
  const [importContacts, setImportContacts] = useState('');
  const [importText, setImportText] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const submitImportedReview = async () => {
    setImportSubmitting(true);
    setImportMessage('');
    try {
      const res = await fetch('/api/admin/imported-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: cleaner.userId,
          source: importSource.trim(),
          rating: Number(importRating),
          reviewerName: importReviewer.trim() || undefined,
          referenceContacts: importContacts.trim() || undefined,
          text: importText.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportMessage('Added — now pending in the Reviews verification queue.');
        setImportSource('');
        setImportRating('');
        setImportReviewer('');
        setImportContacts('');
        setImportText('');
      } else {
        setImportMessage(d.error || 'Could not add the review.');
      }
    } catch {
      setImportMessage('Network error — could not add the review.');
    } finally {
      setImportSubmitting(false);
    }
  };

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

  const handleFoundingToggle = async () => {
    setFoundingBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/cleaners/${cleaner.userId}/founding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founding: !founding }),
      });
      if (res.ok) {
        setFounding(!founding);
      } else {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || 'Failed to update badge.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setFoundingBusy(false);
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
      VERIFIED: 'bg-trust/10 text-trust border-trust/20',
      PENDING: 'bg-warning/10 text-warning border-warning/20',
      REJECTED: 'bg-danger/10 text-danger border-danger/20',
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
    <tr key={doc.id} className="hover:bg-page">
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${docTypeBadge[doc.documentType] || 'bg-page text-ink-2'}`}
        >
          {docTypeLabel[doc.documentType] || doc.documentType}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-ink">{doc.originalName}</td>
      <td className="px-4 py-3 text-sm text-ink-3">{formatBytes(doc.fileSize)}</td>
      <td className="px-4 py-3 text-sm text-ink-3">{formatDate(doc.createdAt)}</td>
      <td className="px-4 py-3">
        {doc.isVerified ? (
          <span className="inline-flex rounded-full bg-trust/10 px-2 py-0.5 text-xs font-medium text-trust">
            Verified
          </span>
        ) : doc.rejectedAt ? (
          /* F7: the rejection reason lives on the row, not just the state. */
          <div>
            <span className="inline-flex rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
              Rejected
            </span>
            <p className="mt-1 max-w-[220px] text-xs text-danger">
              {doc.rejectionReason || 'No reason recorded'}
            </p>
          </div>
        ) : (
          <span className="inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            Pending
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => openDocument(doc.id)}
          className="text-sm font-medium text-primary hover:text-primary"
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
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-2 mb-6"
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
              ? 'bg-trust/10 border-trust/20 text-trust'
              : 'bg-danger/10 border-danger/20 text-danger'
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
        <div className="flex items-start gap-4">
          {/* F4 addendum: the server component resolved the photo URL but nothing
              here ever rendered it — the dossier had NO avatar element at all. */}
          <CleanerAvatar photo={cleaner.image} name={cleaner.name} size={56} />
          <div>
            <h1 className="text-2xl font-bold text-ink">{cleaner.name}</h1>
            <p className="text-ink-3">
              {cleaner.email}{' '}
              {cleaner.emailVerified ? (
                <span
                  className="ml-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                  title={`Verified ${new Date(cleaner.emailVerified).toLocaleDateString('en-GB')}`}
                >
                  ✓ Email verified {new Date(cleaner.emailVerified).toLocaleDateString('en-GB')}
                </span>
              ) : (
                <span className="ml-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Email unverified
                </span>
              )}
            </p>
            {cleaner.phone && <p className="text-ink-3 text-sm">{cleaner.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {verificationBadge()}
          {verified && (
            <svg
              className="w-6 h-6 text-trust"
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
      <section className="bg-surface rounded-xl border border-line p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Basic Information</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-ink-3">Postcode</dt>
            <dd className="font-medium text-ink">{cleaner.postcode || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Area</dt>
            <dd className="font-medium text-ink">{cleaner.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Signed up</dt>
            <dd className="font-medium text-ink">{formatDate(cleaner.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Tier</dt>
            <dd className="font-medium text-ink capitalize">{cleaner.tier.toLowerCase()}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Completed jobs</dt>
            <dd className="font-medium text-ink">{cleaner.completedJobs}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Rating</dt>
            <dd className="font-medium text-ink">
              {cleaner.rating > 0 ? cleaner.rating.toFixed(1) : 'N/A'}
            </dd>
          </div>
          {/* H107: "Travel radius" removed — it displayed a schema default (10)
              nobody collects and live matching never consults. The live model
              is the Catchment section below. */}
          <div>
            <dt className="text-ink-3">Travel mode</dt>
            <dd className="font-medium text-ink capitalize">
              {cleaner.travelMode?.replace(/_/g, ' ') || '—'}
              <span className="ml-1 font-normal normal-case text-ink-3">
                (not used in matching)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Experience</dt>
            <dd className="font-medium text-ink">
              {cleaner.yearsExperience !== null ? `${cleaner.yearsExperience} years` : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* H107 item 2: the LIVE matching model — polygon truth + maxTravelMinutes.
          This is what cleanerCoversPoint actually consults; everything above is
          identity/profile. No map component exists in the repo, so the polygon
          is reported as facts, not drawn. */}
      <section className="bg-surface rounded-xl border border-line p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Catchment</h2>
        <p className="text-sm text-ink-3 mb-4">
          The live matching model: drive-time polygon first, crow-flies fallback (25&nbsp;mph
          &times; max travel time) when no polygon is stored.
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-ink-3">Home postcode</dt>
            <dd className="font-medium text-ink">
              {cleaner.homePostcode || cleaner.postcode || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Max travel time</dt>
            <dd className="font-medium text-ink">
              {cleaner.maxTravelMinutes !== null ? (
                `${cleaner.maxTravelMinutes} min`
              ) : (
                <span className="text-danger">not set — not matchable</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Geocoded</dt>
            <dd className="font-medium text-ink">
              {cleaner.hasGeo ? 'Yes' : <span className="text-danger">No — not matchable</span>}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-ink-3">Drive-time polygon</dt>
            <dd className="font-medium text-ink">
              {cleaner.hasCatchmentPolygon ? (
                <>
                  <span className="text-trust">Present</span>
                  {cleaner.catchmentGeneratedAt && (
                    <span className="font-normal text-ink-2">
                      {' '}
                      — minted {formatDate(cleaner.catchmentGeneratedAt)}
                    </span>
                  )}
                  {cleaner.catchmentSource && (
                    <span className="font-normal text-ink-3"> ({cleaner.catchmentSource})</span>
                  )}
                </>
              ) : (
                <span className="text-warning">Absent — matching uses the crow-flies fallback</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bio & Services */}
      <section className="bg-surface rounded-xl border border-line p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Profile</h2>
        {cleaner.bio && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-ink-3 mb-1">Bio</h3>
            <p className="text-sm text-ink">{cleaner.bio}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="text-ink-3 mb-1">Hourly rate</h3>
            <p className="font-medium text-ink">
              &pound;{(cleaner.hourlyRateRegular ?? 0).toFixed(2)}
            </p>
          </div>
          <div>
            <h3 className="text-ink-3 mb-1">Hours/week</h3>
            <p className="font-medium text-ink">{cleaner.hoursPerWeek ?? '—'}</p>
          </div>
          {cleaner.specialties.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-ink-3 mb-1">Specialties</h3>
              <div className="flex flex-wrap gap-1">
                {cleaner.specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-ink-2"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cleaner.serviceTypes.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-ink-3 mb-1">Service types</h3>
              <div className="flex flex-wrap gap-1">
                {cleaner.serviceTypes.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cleaner.languages.length > 0 && (
            <div className="col-span-2">
              <h3 className="text-ink-3 mb-1">Languages</h3>
              <p className="font-medium text-ink">{cleaner.languages.join(', ')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-surface rounded-xl border border-line p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Compliance</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-ink-3">Background check</dt>
            <dd
              className={`font-medium ${cleaner.backgroundCheckPassed ? 'text-trust' : 'text-ink-3'}`}
            >
              {cleaner.backgroundCheckPassed ? 'Passed' : 'Not completed'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">DBS cert</dt>
            <dd className={`font-medium ${cleaner.dbsCertVerified ? 'text-trust' : 'text-ink-3'}`}>
              {cleaner.dbsCertNumber || '—'}
              {cleaner.dbsCertVerified && ' (verified)'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Identity verified</dt>
            <dd
              className={`font-medium ${cleaner.identityVerifiedAt ? 'text-trust' : 'text-ink-3'}`}
            >
              {cleaner.identityVerifiedAt ? formatDate(cleaner.identityVerifiedAt) : 'No'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Insurance</dt>
            <dd
              className={`font-medium ${cleaner.insuranceVerified ? 'text-trust' : 'text-ink-3'}`}
            >
              {cleaner.insuranceVerified ? 'Verified' : 'Not verified'}
              {cleaner.insuranceExpiresAt && ` (exp. ${formatDate(cleaner.insuranceExpiresAt)})`}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Right to work</dt>
            <dd className="font-medium text-ink">
              {cleaner.rightToWorkStatus || '—'}
              {cleaner.rightToWorkDocType && ` (${cleaner.rightToWorkDocType})`}
            </dd>
          </div>
          {cleaner.rightToWorkExpiresAt && (
            <div>
              <dt className="text-ink-3">RTW expires</dt>
              <dd className="font-medium text-ink">{formatDate(cleaner.rightToWorkExpiresAt)}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Selfie + Photo ID side-by-side */}
      {(selfieDoc || photoIdDoc) && (
        <section className="bg-surface rounded-xl border border-line p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Identity Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-line rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-ink-3 mb-2">Selfie</p>
              {selfieDoc ? (
                <button
                  onClick={() => openDocument(selfieDoc.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  View Selfie
                </button>
              ) : (
                <p className="text-sm text-ink-3">Not uploaded</p>
              )}
              {selfieDoc && (
                <p className="text-xs text-ink-3 mt-2">
                  Uploaded {formatDate(selfieDoc.createdAt)} &middot;{' '}
                  {formatBytes(selfieDoc.fileSize)}
                </p>
              )}
              {/* H97: capture-vs-upload provenance — an uploaded file is not a
                  live capture; review it against the ID with that in mind. */}
              {selfieDoc &&
                (() => {
                  const prov = cleaner.verificationMeta?.selfieProvenance;
                  if (prov === 'webcam' || prov === 'capture') {
                    return (
                      <span className="mt-2 inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Captured live ({prov === 'webcam' ? 'webcam' : 'phone camera'})
                      </span>
                    );
                  }
                  if (prov === 'upload') {
                    return (
                      <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Uploaded file — NOT captured live
                      </span>
                    );
                  }
                  return (
                    <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Provenance unknown (pre-H97 signup)
                    </span>
                  );
                })()}
            </div>
            <div className="border border-line rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-ink-3 mb-2">Photo ID</p>
              {photoIdDoc ? (
                <button
                  onClick={() => openDocument(photoIdDoc.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  View Photo ID
                </button>
              ) : (
                <p className="text-sm text-ink-3">Not uploaded</p>
              )}
              {photoIdDoc && (
                <p className="text-xs text-ink-3 mt-2">
                  Uploaded {formatDate(photoIdDoc.createdAt)} &middot;{' '}
                  {formatBytes(photoIdDoc.fileSize)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Documents */}
      <section className="bg-surface rounded-xl border border-line p-6 mb-6">
        <h2 className="text-lg font-semibold text-ink mb-4">
          Documents ({cleaner.documents.length})
        </h2>
        {otherDocs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase">Type</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase">Name</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase">Size</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase">Uploaded</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-ink-3 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">{otherDocs.map(renderDocRow)}</tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-3">No documents uploaded.</p>
        )}
      </section>

      {/* F-B: founding badge (permanent, admin-settable; auto-set for the
          first N go-lives via founding_cleaner_limit) */}
      <section className="bg-surface rounded-xl border border-line p-6">
        <h2 className="text-lg font-semibold text-ink mb-2">Founding Cleaner Badge</h2>
        <p className="text-sm text-ink-3 mb-4">
          {founding
            ? 'This cleaner carries the permanent founding badge.'
            : 'This cleaner does not have the founding badge.'}
        </p>
        <button
          onClick={handleFoundingToggle}
          disabled={foundingBusy}
          className={`inline-flex items-center rounded-lg px-6 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
            founding
              ? 'border border-line text-ink-2 hover:bg-page'
              : 'bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {foundingBusy ? 'Saving…' : founding ? 'Remove founding badge' : 'Grant founding badge'}
        </button>
      </section>

      {/* Verification Actions */}
      <section className="bg-surface rounded-xl border border-line p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Verification Actions</h2>

        {verificationStatus === 'REJECTED' &&
          typeof cleaner.verificationMeta?.rejectionReason === 'string' && (
            <div className="mb-4 rounded-lg bg-danger/10 border border-danger/20 p-4">
              <p className="text-sm font-medium text-danger">Previous rejection reason:</p>
              <p className="text-sm text-danger mt-1">
                &ldquo;{String(cleaner.verificationMeta.rejectionReason)}&rdquo;
              </p>
            </div>
          )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={processing || verified}
              className="inline-flex items-center rounded-lg bg-trust px-6 py-2.5 text-sm font-medium text-white hover:bg-trust disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Verify Cleaner'}
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={processing}
              className="inline-flex items-center rounded-lg bg-danger px-6 py-2.5 text-sm font-medium text-white hover:bg-danger disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Cleaner
            </button>
          </div>

          {showRejectForm && (
            <div className="border border-line rounded-lg p-4">
              <p className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-3">
                This reason will be shown to the cleaner in their rejection email. Be professional
                and factual.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Rejection reason (required, max 500 characters)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger focus:border-danger"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ink-3">{rejectReason.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectReason('');
                    }}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg border border-line text-ink-2 hover:bg-page"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing || !rejectReason.trim()}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-danger text-white hover:bg-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* P7 (ledger, onboarding-help ruling): admin adds an imported review on
          the cleaner's behalf — cap-exempt, lands PENDING in the Reviews queue
          for the normal verification pass. */}
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Add imported review</h2>
        <p className="mb-4 text-sm text-ink-3">
          Enters the verification queue as pending — it counts toward nothing until approved there.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={importSource}
            onChange={(e) => setImportSource(e.target.value)}
            maxLength={200}
            placeholder="Source platform (required, e.g. Checkatrade)"
            className="rounded-lg border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={importRating}
            onChange={(e) => setImportRating(e.target.value)}
            inputMode="decimal"
            placeholder="Rating 1–5 (required)"
            className="rounded-lg border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={importReviewer}
            onChange={(e) => setImportReviewer(e.target.value)}
            maxLength={200}
            placeholder="Reviewer name (optional)"
            className="rounded-lg border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={importContacts}
            onChange={(e) => setImportContacts(e.target.value)}
            maxLength={1000}
            placeholder="Reference contact (optional)"
            className="rounded-lg border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Review text (optional)"
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {importMessage && (
          <p
            className={`mt-2 text-sm ${importMessage.startsWith('Added') ? 'text-trust' : 'text-danger'}`}
          >
            {importMessage}
          </p>
        )}
        <button
          onClick={submitImportedReview}
          disabled={importSubmitting || !importSource.trim() || !importRating.trim()}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {importSubmitting ? 'Adding…' : 'Add to verification queue'}
        </button>
      </section>
    </div>
  );
}
