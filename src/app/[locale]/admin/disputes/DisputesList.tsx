'use client';

import { useState, useTransition } from 'react';

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

const statusLabels: Record<DisputeStatus, string> = {
  open: 'Open',
  'under-review': 'Under Review',
  'resolved-customer': 'Resolved (Customer)',
  'resolved-cleaner': 'Resolved (Cleaner)',
  'resolved-split': 'Resolved (Split)',
  escalated: 'Escalated',
};

const statusStyles: Record<DisputeStatus, string> = {
  open: 'bg-danger/10 text-danger',
  'under-review': 'bg-warning/10 text-warning',
  'resolved-customer': 'bg-trust/10 text-trust',
  'resolved-cleaner': 'bg-trust/10 text-trust',
  'resolved-split': 'bg-primary-soft text-primary',
  escalated: 'bg-purple-100 text-purple-700',
};

interface DisputesListProps {
  initialDisputes: AdminDispute[];
  resolveAction: (disputeId: string, resolution: DisputeStatus) => Promise<void>;
}

export default function DisputesList({ initialDisputes, resolveAction }: DisputesListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [disputes, setDisputes] = useState(initialDisputes);
  const [isPending, startTransition] = useTransition();

  const filtered =
    statusFilter === 'all' ? disputes : disputes.filter((d) => d.status === statusFilter);

  const handleResolve = (id: string, resolution: DisputeStatus) => {
    // Optimistically update the UI
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: resolution } : d)));

    startTransition(async () => {
      try {
        await resolveAction(id, resolution);
      } catch {
        // Revert on error
        setDisputes(initialDisputes);
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Disputes</h1>
          <p className="text-ink-3 mt-1">
            {
              disputes.filter(
                (d) =>
                  d.status === 'open' || d.status === 'under-review' || d.status === 'escalated'
              ).length
            }{' '}
            active disputes
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
          <option value="resolved-customer">Resolved (Customer)</option>
          <option value="resolved-cleaner">Resolved (Cleaner)</option>
          <option value="resolved-split">Resolved (Split)</option>
        </select>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
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
            <p className="mt-4 text-lg font-medium text-ink">No disputes found</p>
            <p className="mt-1 text-sm text-ink-3">No disputes matching the selected filter.</p>
          </div>
        ) : (
          filtered.map((dispute) => (
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
                      Customer:{' '}
                      <span className="font-medium text-ink-2">{dispute.customerName}</span>
                    </span>
                    <span>
                      Cleaner: <span className="font-medium text-ink-2">{dispute.cleanerName}</span>
                    </span>
                    <span>
                      Amount: <span className="font-medium text-ink-2">£{dispute.amount}</span>
                    </span>
                    <span>
                      Filed by:{' '}
                      <span className="capitalize font-medium text-ink-2">{dispute.filedBy}</span>
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
                            <span className="max-w-[160px] truncate">
                              {ev.fileName || 'evidence'}
                            </span>
                            <span className="text-ink-3">· {ev.uploadedBy}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-col">
                  {(dispute.status === 'open' || dispute.status === 'under-review') && (
                    <>
                      <button
                        onClick={() => handleResolve(dispute.id, 'under-review')}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-warning/10 text-warning border border-warning/20 text-sm font-medium rounded-lg hover:bg-warning/10 transition-colors disabled:opacity-50"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleResolve(dispute.id, 'resolved-customer')}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-trust/10 text-trust border border-trust/20 text-sm font-medium rounded-lg hover:bg-trust/10 transition-colors disabled:opacity-50"
                      >
                        For Customer
                      </button>
                      <button
                        onClick={() => handleResolve(dispute.id, 'resolved-cleaner')}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-primary-soft text-primary border border-primary/20 text-sm font-medium rounded-lg hover:bg-primary-soft transition-colors disabled:opacity-50"
                      >
                        For Cleaner
                      </button>
                      <button
                        onClick={() => handleResolve(dispute.id, 'resolved-split')}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        Split
                      </button>
                    </>
                  )}
                  {dispute.status === 'open' && (
                    <button
                      onClick={() => handleResolve(dispute.id, 'escalated')}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 text-sm font-medium rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50"
                    >
                      Escalate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
