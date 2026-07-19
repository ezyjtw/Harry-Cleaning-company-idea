'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { DisputeStatus, DisputeReason } from '@/lib/types';

export interface AdminDisputeEvidence {
  id: string;
  type: string;
  fileName: string | null;
  uploadedBy: 'customer' | 'cleaner' | 'Rena team';
  url: string;
}

export interface AdminDispute {
  id: string;
  bookingRef: string;
  customerName: string;
  cleanerName: string;
  reason: DisputeReason;
  description: string;
  dateRaised: string;
  status: DisputeStatus;
  amount: number;
  filedBy: 'customer' | 'cleaner';
  evidence: AdminDisputeEvidence[];
}

const reasonLabels: Record<DisputeReason, string> = {
  'no-show-cleaner': 'No Show (Cleaner)',
  'no-show-customer': 'No Show (Customer)',
  'poor-quality': 'Poor Quality',
  'property-damage': 'Property Damage',
  'incorrect-duration': 'Incorrect Duration',
  'safety-concern': 'Safety Concern',
  'payment-issue': 'Payment Issue',
  other: 'Other',
};

// H61 (Harry-ruled): pill lifecycle open → resolved, with the resolution
// FLAVOUR spelled out in money terms.
const statusLabels: Record<DisputeStatus, string> = {
  open: 'Open',
  'under-review': 'Under Review',
  'resolved-customer': 'Resolved — refunded (full)',
  'resolved-cleaner': 'Resolved — no refund',
  'resolved-split': 'Resolved — refunded (partial)',
  dismissed: 'Dismissed',
  escalated: 'Escalated',
};

const ACTIVE_STATUSES: DisputeStatus[] = ['open', 'under-review', 'escalated'];

const statusStyles: Record<DisputeStatus, string> = {
  open: 'bg-danger/10 text-danger',
  'under-review': 'bg-warning/10 text-warning',
  'resolved-customer': 'bg-trust/10 text-trust',
  'resolved-cleaner': 'bg-trust/10 text-trust',
  'resolved-split': 'bg-primary-soft text-primary',
  dismissed: 'bg-page text-ink-3',
  escalated: 'bg-purple-100 text-purple-700',
};

interface DisputesListProps {
  initialDisputes: AdminDispute[];
}

export default function DisputesList({ initialDisputes }: DisputesListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [disputes] = useState(initialDisputes);

  const filtered =
    statusFilter === 'all' ? disputes : disputes.filter((d) => d.status === statusFilter);

  // H61: resolved/dismissed cases leave the active queue for their own
  // section — the queue shows only cases that still need working.
  const activeCases = filtered.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const resolvedCases = filtered.filter((d) => !ACTIVE_STATUSES.includes(d.status));

  const renderCard = (dispute: AdminDispute) => (
    <div key={dispute.id} className="bg-surface rounded-xl border border-line p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-mono text-ink-3">{dispute.id}</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[dispute.status]}`}
            >
              {statusLabels[dispute.status]}
            </span>
            <span className="inline-flex items-center rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-ink-2">
              {reasonLabels[dispute.reason] || dispute.reason}
            </span>
          </div>
          <p className="text-sm text-ink-2 mb-3">{dispute.description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-3">
            <span>
              Booking: <span className="font-mono">{dispute.bookingRef}</span>
            </span>
            <span>
              Customer: <span className="font-medium text-ink-2">{dispute.customerName}</span>
            </span>
            <span>
              Cleaner: <span className="font-medium text-ink-2">{dispute.cleanerName}</span>
            </span>
            <span>
              Amount: <span className="font-medium text-ink-2">£{dispute.amount}</span>
            </span>
            <span>
              Filed by: <span className="capitalize font-medium text-ink-2">{dispute.filedBy}</span>
            </span>
            <span>Date: {dispute.dateRaised}</span>
          </div>

          {dispute.evidence.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Evidence ({dispute.evidence.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dispute.evidence.map((ev) => (
                  <a
                    key={ev.id}
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-page px-2.5 py-1 text-xs text-ink-2 hover:bg-page"
                  >
                    <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-2">
                      {ev.type.toLowerCase()}
                    </span>
                    <span className="max-w-[160px] truncate">{ev.fileName || 'evidence'}</span>
                    <span className="text-ink-3">· {ev.uploadedBy}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          {/* James-ruled: the money-blind status buttons are gone. The
                      case opens the full investigation view (evidence, thread,
                      money context) where the REAL money-aware resolution lives
                      (release / refund / split with server-side guards). */}
          <Link
            href={`/admin/disputes/${dispute.id.toLowerCase()}`}
            className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-1.5 text-center text-sm font-medium text-warning transition-colors hover:bg-warning/20"
          >
            {dispute.status === 'open' ? 'Review case' : 'Open case'}
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Disputes</h1>
          {/* H61: the queue count is OPEN work only — resolved cases never
              inflate it. */}
          <p className="text-ink-3 mt-1">
            {disputes.filter((d) => ACTIVE_STATUSES.includes(d.status)).length} active disputes
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="under-review">Under Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved-customer">Resolved — refunded (full)</option>
          <option value="resolved-split">Resolved — refunded (partial)</option>
          <option value="resolved-cleaner">Resolved — no refund</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {/* Active queue */}
      <div className="space-y-4">
        {activeCases.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-xl border border-line">
            <svg
              className="mx-auto w-12 h-12 text-ink-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-4 text-lg font-medium text-ink">No active disputes</p>
            <p className="mt-1 text-sm text-ink-3">
              {statusFilter === 'all'
                ? 'The queue is clear.'
                : 'No active disputes matching the selected filter.'}
            </p>
          </div>
        ) : (
          activeCases.map(renderCard)
        )}
      </div>

      {/* H61 (Harry-ruled): resolved/completed cases live BELOW the queue,
          out of the way but on the record — pill carries the money flavour. */}
      {resolvedCases.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em] text-ink-3">
            Resolved / Completed ({resolvedCases.length})
          </h2>
          <div className="space-y-4">{resolvedCases.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
}
