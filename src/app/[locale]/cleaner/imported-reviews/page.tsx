'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import StarRating from '@/components/StarRating';

interface ImportedReviewItem {
  id: string;
  rating: number;
  text: string | null;
  source: string;
  reviewerName: string | null;
  hasEvidence: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminNotes: string | null;
  createdAt: string;
}

interface ListResponse {
  reviews: ImportedReviewItem[];
  maxAllowed: number;
  remaining: number;
}

const SOURCES = [
  'Google',
  'Checkatrade',
  'Bark',
  'Trustpilot',
  'Yell',
  'Facebook',
  'Personal reference',
  'Other',
];

// Mirror of the server-side evidence validation so the user gets fast feedback.
const ACCEPTED_EVIDENCE = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function StatusBadge({ status }: { status: ImportedReviewItem['verificationStatus'] }) {
  const map = {
    PENDING: { label: 'Pending review', cls: 'bg-warning/10 text-warning' },
    VERIFIED: { label: 'Verified', cls: 'bg-trust/10 text-trust' },
    REJECTED: { label: 'Not verified', cls: 'bg-danger/10 text-danger' },
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-jost text-[11px] font-medium ${map.cls}`}
    >
      {map.label}
    </span>
  );
}

export default function CleanerImportedReviewsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [source, setSource] = useState('Google');
  const [sourceOther, setSourceOther] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [referenceContacts, setReferenceContacts] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/cleaner/imported-reviews');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // leave data null; UI shows the empty/loading state
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const resetForm = () => {
    setSource('Google');
    setSourceOther('');
    setRating(0);
    setText('');
    setReviewerName('');
    setReferenceContacts('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const resolvedSource = source === 'Other' ? sourceOther.trim() : source;
    if (!resolvedSource) {
      setError('Please enter the review source.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('Please select an overall rating between 1 and 5 stars.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload evidence first (if provided) via the SECURE evidence endpoint.
      //    This is multipart FormData — the endpoint validates magic bytes, size,
      //    auth, and encrypts at rest. We never POST the file to any other path.
      let evidenceUrl: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const upRes = await fetch('/api/cleaner/imported-reviews/evidence', {
          method: 'POST',
          body: fd,
        });
        if (upRes.status === 401) {
          router.push('/login');
          return;
        }
        const upJson = await upRes.json().catch(() => null);
        if (!upRes.ok) {
          setError(upJson?.error || 'Evidence upload failed. Please try a different file.');
          setSubmitting(false);
          return;
        }
        evidenceUrl = upJson.evidenceUrl;
      }

      // 2. Submit the imported review → PENDING.
      const res = await fetch('/api/cleaner/imported-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: resolvedSource,
          rating,
          text: text.trim() || null,
          reviewerName: reviewerName.trim() || null,
          referenceContacts: referenceContacts.trim() || null,
          evidenceUrl,
        }),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || 'Could not submit. Please try again.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      resetForm();
      await fetchList();
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = data?.remaining ?? 0;
  const maxAllowed = data?.maxAllowed ?? 3;
  const canAdd = remaining > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-10 lg:py-10">
      <header className="mb-6">
        <h1 className="font-cormorant text-[26px] font-semibold text-ink">Imported reviews</h1>
        <p className="mt-1 font-jost text-sm font-light text-ink-2">
          Bring reviews from other platforms (Google, Checkatrade, a personal reference) onto your
          Rena profile. Each is checked by our team before it appears publicly, and is always
          labelled &ldquo;Imported from&rdquo; so it&rsquo;s never passed off as a Rena review. You
          can add up to {maxAllowed}.
        </p>
      </header>

      {/* Add form */}
      <section
        className="rounded-xl bg-white p-5 lg:p-6"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-jost text-[15px] font-medium text-ink">Add an imported review</h2>
          <span className="font-jost text-[12px] font-light text-ink-3">
            {remaining} of {maxAllowed} remaining
          </span>
        </div>

        {!canAdd && !loading && (
          <div
            className="rounded-lg bg-cream px-4 py-3"
            style={{ border: '1px solid rgba(14,14,12,0.08)' }}
          >
            <p className="font-jost text-sm font-light text-ink-2">
              You&rsquo;ve reached the maximum of {maxAllowed} imported reviews. Remove or wait for
              a decision on an existing one to add another.
            </p>
          </div>
        )}

        {canAdd && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1.5 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {source === 'Other' && (
                <input
                  type="text"
                  value={sourceOther}
                  onChange={(e) => setSourceOther(e.target.value)}
                  placeholder="e.g. Nextdoor, a letting agency"
                  maxLength={200}
                  className="mt-2 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
                  style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                />
              )}
            </div>

            {/* Overall rating — NO sub-ratings on imports (locked rule) */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">Overall rating</label>
              <div className="mt-1.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className="text-2xl leading-none transition"
                  >
                    <span className={n <= rating ? 'text-rating' : 'text-ink-3/25'}>★</span>
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 font-jost text-[13px] font-light text-ink-2">
                    {rating} / 5
                  </span>
                )}
              </div>
              <p className="mt-1 font-jost text-[11px] font-light text-ink-3">
                Imported reviews carry an overall rating only — the per-category bars (thoroughness,
                punctuality, communication) reflect Rena jobs only.
              </p>
            </div>

            {/* Review text */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">
                Review text <span className="font-light text-ink-3">(optional)</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Paste or summarise what the reviewer wrote."
                className="mt-1.5 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>

            {/* Reviewer name */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">
                Reviewer name <span className="font-light text-ink-3">(optional)</span>
              </label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Sarah M."
                className="mt-1.5 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>

            {/* Evidence upload — uses the SECURE endpoint */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">
                Evidence{' '}
                <span className="font-light text-ink-3">(screenshot or PDF, optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EVIDENCE}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_EVIDENCE_BYTES) {
                    setError('File too large. Maximum size is 10MB.');
                    e.target.value = '';
                    setFile(null);
                    return;
                  }
                  setError('');
                  setFile(f);
                }}
                className="mt-1.5 block w-full font-jost text-[13px] font-light text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:font-jost file:text-[12px] file:font-light file:text-cream hover:file:bg-ink/90"
              />
              <p className="mt-1 font-jost text-[11px] font-light text-ink-3">
                Helps our team verify faster. JPG, PNG, WebP or PDF, up to 10MB. Stored securely and
                only visible to our verification team.
              </p>
            </div>

            {/* Reference contacts */}
            <div>
              <label className="font-jost text-[13px] font-medium text-ink-2">
                Reference contact details{' '}
                <span className="font-light text-ink-3">(for personal references, optional)</span>
              </label>
              <textarea
                value={referenceContacts}
                onChange={(e) => setReferenceContacts(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Name, phone or email our team can use to confirm a personal reference."
                className="mt-1.5 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>

            {error && (
              <div
                className="rounded-lg bg-red-50 px-4 py-3"
                style={{ border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <p className="font-jost text-sm font-light text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-ink px-5 py-2 font-jost text-[13px] font-light text-cream transition hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
              {success && (
                <span className="font-jost text-sm font-light text-green-600">
                  Submitted — pending review.
                </span>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Existing submissions with status badges */}
      <section className="mt-8">
        <h2 className="mb-3 font-jost text-[15px] font-medium text-ink">Your imported reviews</h2>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/5" />
            ))}
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <p className="font-jost text-sm font-light text-ink-3">
            You haven&rsquo;t imported any reviews yet.
          </p>
        ) : (
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-white p-5"
                style={{ border: '1px solid rgba(14,14,12,0.06)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-jost text-[13px] font-medium text-ink">
                        Imported from {r.source}
                      </span>
                      <StarRating rating={r.rating} />
                    </div>
                    {r.reviewerName && (
                      <p className="mt-0.5 font-jost text-[12px] font-light text-ink-3">
                        {r.reviewerName}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={r.verificationStatus} />
                </div>

                {r.text && (
                  <p className="mt-2 font-jost text-[14px] font-light text-ink-2">{r.text}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {r.hasEvidence && (
                    <span className="font-jost text-[11px] font-light text-ink-3">
                      Evidence attached
                    </span>
                  )}
                  <span className="font-jost text-[11px] font-light text-ink-3">
                    Added {new Date(r.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>

                {r.verificationStatus === 'REJECTED' && r.adminNotes && (
                  <div
                    className="mt-3 rounded-lg bg-red-50 px-3 py-2"
                    style={{ border: '1px solid rgba(239,68,68,0.12)' }}
                  >
                    <p className="font-jost text-[12px] font-light text-red-700">
                      <span className="font-medium">Reason:</span> {r.adminNotes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
