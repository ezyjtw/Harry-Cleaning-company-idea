'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { CleanerRow } from './page';

const ITEMS_PER_PAGE = 8;

export default function AdminCleanersClient({
  cleaners,
  total,
}: {
  cleaners: CleanerRow[];
  total: number;
}) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  // H106: broom for incomplete signups — grey rows only; the server guard is
  // structural (role CLEANER + no profile + no bookings), this is just the door.
  const [removing, setRemoving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // F26: local overrides after a Hide/Show toggle (server rows are static).
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [visibilityBusy, setVisibilityBusy] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  async function toggleVisibility(id: string, visible: boolean) {
    setVisibilityBusy(id);
    setVisibilityError(null);
    try {
      const res = await fetch(`/api/admin/cleaners/${id}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      });
      if (res.ok) {
        setVisibility((prev) => ({ ...prev, [id]: visible }));
      } else {
        const d = await res.json().catch(() => ({}));
        setVisibilityError(d.error || 'Could not update visibility.');
      }
    } catch {
      setVisibilityError('Network error — please try again.');
    } finally {
      setVisibilityBusy(null);
    }
  }

  async function removeIncomplete(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/admin/cleaners/incomplete/${id}`, { method: 'DELETE' });
      if (res.ok) setRemoved((prev) => new Set(prev).add(id));
      else {
        const d = await res.json().catch(() => ({}));
        setRemoveError(d.error || 'Could not remove this signup.');
      }
    } finally {
      setRemoving(null);
      setConfirmRemove(null);
    }
  }

  const filtered = cleaners.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    if (removed.has(c.fullId)) return false;
    const matchesTier = tierFilter === 'all' || c.tier === tierFilter;
    const matchesVerified =
      verifiedFilter === 'all' || (verifiedFilter === 'verified' ? c.verified : !c.verified);
    return matchesSearch && matchesTier && matchesVerified;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const tierStyles: Record<string, string> = {
    starter: 'bg-page text-ink-2',
    bronze: 'bg-orange-100 text-orange-700',
    silver: 'bg-line text-ink-2',
    gold: 'bg-warning/10 text-warning',
    elite: 'bg-purple-100 text-purple-700',
  };

  const statusStyles: Record<string, string> = {
    active: 'bg-trust/10 text-trust',
    suspended: 'bg-danger/10 text-danger',
    'pending-approval': 'bg-warning/10 text-warning',
    // H99 ①: step-0 account, wizard unfinished — not a reviewable applicant.
    'signup-incomplete': 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cleaners</h1>
          <p className="text-ink-3 mt-1">{total} total cleaners</p>
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-4 py-2.5 rounded-lg border border-line text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Tiers</option>
          <option value="starter">Starter</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="elite">Elite</option>
        </select>
        <select
          value={verifiedFilter}
          onChange={(e) => {
            setVerifiedFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {visibilityError && (
        <div className="mb-4 rounded-lg bg-danger/10 px-4 py-3 font-jost text-sm text-danger">
          {visibilityError}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Cleaner
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden md:table-cell">
                  Tier
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Rating
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden lg:table-cell">
                  Verified
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden md:table-cell">
                  Docs
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden sm:table-cell">
                  Active
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginated.map((cleaner) => (
                <tr key={cleaner.fullId} className="hover:bg-page transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/cleaners/${cleaner.fullId}`} className="block">
                      <p className="text-sm font-medium text-primary hover:text-primary">
                        {cleaner.name}
                      </p>
                      <p className="text-xs text-ink-3">
                        {cleaner.email}{' '}
                        {cleaner.emailVerified ? (
                          <span className="text-trust" title="Email verified">
                            ✓
                          </span>
                        ) : (
                          <span
                            className="rounded bg-amber-50 px-1 text-[10px] text-amber-700"
                            title="Email not verified"
                          >
                            unverified
                          </span>
                        )}
                      </p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tierStyles[cleaner.tier] || tierStyles.starter}`}
                    >
                      {cleaner.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {cleaner.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4 text-warning"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium text-ink">
                          {cleaner.rating.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-ink-3">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {cleaner.verified ? (
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
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-ink-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink-2">{cleaner.docCount}</span>
                      {cleaner.hasSelfie && (
                        <span className="inline-flex rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Selfie
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-ink hidden sm:table-cell">
                    {cleaner.activeBookings}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[cleaner.status]}`}
                    >
                      {cleaner.status === 'pending-approval'
                        ? 'Pending'
                        : cleaner.status === 'signup-incomplete'
                          ? 'Signup incomplete'
                          : cleaner.status.charAt(0).toUpperCase() + cleaner.status.slice(1)}
                    </span>
                    {/* F26: the admin visibility door — Hidden badge + toggle.
                        Same flag as the cleaner's own control, last-write-wins. */}
                    {cleaner.visibleInDirectory !== null &&
                      (() => {
                        const visible = visibility[cleaner.fullId] ?? cleaner.visibleInDirectory;
                        return (
                          <span className="ml-2 inline-flex items-center gap-1.5">
                            {!visible && (
                              <span
                                data-testid="admin-hidden-badge"
                                className="inline-flex items-center rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink-2"
                              >
                                Hidden
                              </span>
                            )}
                            <button
                              type="button"
                              data-testid="admin-visibility-toggle"
                              title="Hidden cleaners leave search, quotes, and matching, and won't receive rescue or cover offers. Existing bookings are unaffected."
                              disabled={visibilityBusy === cleaner.fullId}
                              onClick={() => toggleVisibility(cleaner.fullId, !visible)}
                              className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                            >
                              {visibilityBusy === cleaner.fullId
                                ? 'Saving…'
                                : visible
                                  ? 'Hide'
                                  : 'Show'}
                            </button>
                          </span>
                        );
                      })()}
                    {cleaner.status === 'signup-incomplete' && (
                      <button
                        type="button"
                        disabled={removing === cleaner.fullId}
                        onClick={() => setConfirmRemove({ id: cleaner.fullId, name: cleaner.name })}
                        className="ml-2 rounded px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-line flex items-center justify-between">
            <p className="text-sm text-ink-3">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-line text-ink-2 hover:bg-page disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-line text-ink-2 hover:bg-page disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {/* H106 confirm modal — states exactly what is removed. */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
            <p className="font-newsreader text-lg font-semibold text-ink">
              Remove {confirmRemove.name}&apos;s incomplete signup?
            </p>
            <p className="mt-2 font-jost text-sm text-ink-2">
              Their account and email will be deleted — this can&apos;t be undone.
            </p>
            {removeError && <p className="mt-2 font-jost text-sm text-danger">{removeError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-[10px] border border-line py-2.5 font-jost text-sm text-ink-2"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={!!removing}
                onClick={() => removeIncomplete(confirmRemove.id)}
                className="flex-1 rounded-[10px] bg-danger py-2.5 font-jost text-sm font-semibold text-white disabled:opacity-60"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
