'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface BookingDetail {
  id: string;
  clientId: string | null;
  cleanerId: string;
  guestEmail: string | null;
  guestName: string | null;
  guestPhone: string | null;
  serviceType: string;
  status: string;
  date: string;
  startTime: string;
  duration: string | number;
  rooms: any;
  extras: string[];
  frequency: string | null;
  totalPrice: string | number;
  platformFee: string | number;
  cleanerEarnings: string | number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cleanerNotes: string | null;
  adminNotes: string | null;
  propertySize: string | null;
  bookingFrequency: string | null;
  cleanerPayoutAmount: string | number | null;
  platformCommissionAmount: string | number | null;
  platformFeeAmount: string | number | null;
  totalAmountCharged: string | number | null;
  customerSubtotal: number | null;
  customerServiceFee: number | null;
  renaEarns: number | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paymentStatus: string;
  stripeTransferId: string | null;
  transferStatus: string;
  transferAttempt: number;
  transferFailureReason: string | null;
  releaseDueAt: string | null;
  completionConfirmedAt: string | null;
  backupCleanerIds: string[];
  autoAssignBackup: boolean;
  cascadePhase: string | null;
  cascadeExpiresAt: string | null;
  cascadeBackupExpiresAt: string | null;
  declinedCleanerIds: string[];
  provisionalCleanerId: string | null;
  provisionalPrice: string | number | null;
  topupAmount: string | number | null;
  approvalExpiresAt: string | null;
  topupApproved: boolean;
  client: { id: string; name: string; email: string; stripeCustomerId: string | null } | null;
  cleaner: {
    id: string;
    name: string;
    email: string;
    cleanerProfile: {
      stripeAccountId: string | null;
      verified: boolean;
      verificationStatus: string | null;
    } | null;
  };
  address: {
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
  } | null;
  payment: {
    id: string;
    amount: string | number;
    status: string;
    refundAmount: string | number | null;
    discountPercent: number | null;
    discountAmount: string | number | null;
    promoCode: string | null;
  } | null;
  refundRecords: {
    id: string;
    stripeRefundId: string | null;
    amount: string | number;
    reason: string;
    triggeredBy: string | null;
    status: string;
    attempt: number;
    failureReason: string | null;
    createdAt: string;
  }[];
  topupRecords: {
    id: string;
    stripePaymentIntentId: string | null;
    amount: string | number;
    reason: string;
    status: string;
    paymentMethodType: string | null;
    attempt: number;
    failureReason: string | null;
    createdAt: string;
  }[];
  review: {
    id: string;
    rating: string | number;
    text: string | null;
    reply: string | null;
    createdAt: string;
  } | null;
  dispute: {
    id: string;
    reason: string;
    description: string;
    status: string;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
    evidence: { id: string; type: string; url: string; fileName: string | null }[];
  } | null;
  bookingAddons: {
    id: string;
    price: number;
    addon: { name: string; price: number };
  }[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function n(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 break-all">{value ?? '—'}</dd>
    </div>
  );
}

function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: 'green' | 'red' | 'amber' | 'blue' | 'gray';
}) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  const auto: Record<string, string> = {
    PENDING: 'amber',
    AWAITING_CLEANER: 'amber',
    ACCEPTED: 'blue',
    CONFIRMED: 'blue',
    EN_ROUTE: 'blue',
    IN_PROGRESS: 'blue',
    COMPLETED: 'green',
    REVIEWED: 'green',
    CANCELLED: 'gray',
    DISPUTED: 'red',
    CASCADE_EXHAUSTED: 'red',
    SUCCEEDED: 'green',
    FAILED: 'red',
    UNKNOWN: 'red',
    REVERSAL_ONLY: 'red',
    RELEASED: 'green',
    RELEASING: 'amber',
    REFUNDED: 'amber',
    REFUNDING: 'amber',
    PAUSED: 'gray',
    SKIPPED: 'gray',
    OPEN: 'red',
    UNDER_REVIEW: 'amber',
    RESOLVED: 'green',
    DISMISSED: 'gray',
    EXPIRED: 'gray',
    DECLINED: 'gray',
  };
  const c = variant || auto[status] || 'gray';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[c as keyof typeof colors] || colors.gray}`}
    >
      {status}
    </span>
  );
}

const VALID_STATUSES = [
  'PENDING',
  'AWAITING_CLEANER',
  'CONFIRMED',
  'ACCEPTED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'REVIEWED',
  'CANCELLED',
  'DISPUTED',
  'CASCADE_EXHAUSTED',
];

const VALID_CASCADE_PHASES = [
  'PRIMARY_OFFER',
  'BACKUP_OFFER',
  'COMBINED_OFFER',
  'CASCADE_EXHAUSTED',
  'PROVISIONAL_APPROVAL',
  'PHASE2_RESERVE',
];

function StatusOverridePanel({ booking }: { booking: BookingDetail }) {
  const [status, setStatus] = useState(booking.status);
  const [cascadePhase, setCascadePhase] = useState(booking.cascadePhase ?? '');
  const [confirmId, setConfirmId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const expectedPrefix = booking.id.substring(0, 8).toUpperCase();
  const hasChanges = status !== booking.status || (cascadePhase || null) !== booking.cascadePhase;
  const confirmed = confirmId.toUpperCase() === expectedPrefix;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = { bookingId: booking.id };
      if (status !== booking.status) payload.status = status;
      if ((cascadePhase || null) !== booking.cascadePhase) {
        payload.cascadePhase = cascadePhase || null;
      }
      const res = await fetch('/api/admin/bookings/override-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error });
      } else {
        setResult({ ok: true, message: `Updated: ${JSON.stringify(data.updated)}` });
      }
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }, [booking.id, booking.status, booking.cascadePhase, status, cascadePhase]);

  return (
    <Section title="Status Override (Dev Only)">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cascade Phase</label>
            <select
              value={cascadePhase}
              onChange={(e) => setCascadePhase(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">(null)</option>
              {VALID_CASCADE_PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasChanges && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">
              Raw status override — bypasses all service guards. Type booking ID prefix to confirm.
            </p>
            <input
              type="text"
              placeholder={expectedPrefix}
              value={confirmId}
              onChange={(e) => setConfirmId(e.target.value)}
              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm font-mono mb-2"
            />
            <div>
              <button
                onClick={handleSubmit}
                disabled={!confirmed || submitting}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Applying…' : 'Apply Override'}
              </button>
            </div>
          </div>
        )}
        {result && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
          >
            {result.message}
          </div>
        )}
      </div>
    </Section>
  );
}

function ForceCascadeButton({ booking }: { booking: BookingDetail }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const phaseLabel: Record<string, string> = {
    PRIMARY_OFFER: 'Expire primary → advance to backup (or exhaust)',
    BACKUP_OFFER: 'Expire backup → CASCADE_EXHAUSTED',
    COMBINED_OFFER: 'Expire combined → CASCADE_EXHAUSTED',
    PROVISIONAL_APPROVAL: 'Expire provisional → Phase 2 or advance reserve',
    PHASE2_RESERVE: 'Promote cheapest reserve → provisional approval',
  };

  const handleAdvance = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const res = await fetch('/api/admin/bookings/force-cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error });
      } else {
        setResult({
          ok: true,
          message: `${data.fromPhase} → ${data.toPhase ?? data.toStatus}`,
        });
      }
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setState('idle');
    }
  }, [booking.id]);

  if (booking.status !== 'AWAITING_CLEANER' || !booking.cascadePhase) return null;

  return (
    <div className="inline-flex items-center gap-2">
      {state === 'confirming' ? (
        <>
          <span className="text-xs text-gray-500">
            {phaseLabel[booking.cascadePhase] ?? `Advance from ${booking.cascadePhase}`}
          </span>
          <button
            onClick={handleAdvance}
            className="px-2 py-1 text-xs font-medium text-white rounded bg-amber-600 hover:bg-amber-700"
          >
            Yes, advance
          </button>
          <button
            onClick={() => {
              setState('idle');
              setResult(null);
            }}
            className="px-2 py-1 text-xs font-medium text-gray-600 rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        </>
      ) : state === 'loading' ? (
        <span className="text-xs text-gray-500">Processing…</span>
      ) : (
        <button
          onClick={() => setState('confirming')}
          className="px-4 py-2 text-sm font-medium text-amber-700 rounded-lg border border-amber-300 hover:bg-amber-50"
        >
          Force Advance Cascade
        </button>
      )}
      {result && (
        <span className={`text-xs ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}

function DeleteBookingButton({ booking }: { booking: BookingDetail }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading'>('idle');
  const [confirmId, setConfirmId] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const expectedPrefix = booking.id.substring(0, 8).toUpperCase();
  const confirmed =
    confirmId.toUpperCase() === expectedPrefix && confirmWord.toUpperCase() === 'DELETE';

  const relationCounts = [
    booking.payment ? '1 payment' : null,
    booking.refundRecords.length > 0 ? `${booking.refundRecords.length} refund records` : null,
    booking.topupRecords.length > 0 ? `${booking.topupRecords.length} topup records` : null,
    booking.review ? '1 review' : null,
    booking.dispute ? '1 dispute' : null,
    booking.bookingAddons.length > 0 ? `${booking.bookingAddons.length} addons` : null,
  ].filter(Boolean);

  const handleDelete = useCallback(async () => {
    setState('loading');
    setResult(null);
    try {
      const res = await fetch('/api/admin/bookings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error });
      } else {
        setResult({ ok: true, message: 'Booking permanently deleted' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setState('idle');
    }
  }, [booking.id]);

  return (
    <div>
      {state === 'confirming' ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Permanently delete this booking?</p>
          <p className="text-xs text-red-700">
            This will destroy: the booking
            {relationCounts.length > 0 ? `, ${relationCounts.join(', ')}` : ''}. Audit log entries
            will be orphaned. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <div>
              <label className="block text-xs text-red-700 mb-1">
                Booking ID prefix ({expectedPrefix})
              </label>
              <input
                type="text"
                placeholder={expectedPrefix}
                value={confirmId}
                onChange={(e) => setConfirmId(e.target.value)}
                className="w-32 rounded border border-red-300 px-2 py-1 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-red-700 mb-1">Type DELETE</label>
              <input
                type="text"
                placeholder="DELETE"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                className="w-24 rounded border border-red-300 px-2 py-1 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!confirmed}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Permanently
            </button>
            <button
              onClick={() => {
                setState('idle');
                setConfirmId('');
                setConfirmWord('');
                setResult(null);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : state === 'loading' ? (
        <span className="text-sm text-gray-500">Deleting…</span>
      ) : (
        <button
          onClick={() => setState('confirming')}
          className="px-4 py-2 text-sm font-medium text-red-700 rounded-lg border border-red-300 hover:bg-red-50"
        >
          Delete Booking
        </button>
      )}
      {result && (
        <div
          className={`mt-2 rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}

function RefundModal({
  bookingId,
  maxRefundable,
  onClose,
}: {
  bookingId: string;
  maxRefundable: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(maxRefundable.toFixed(2));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, amount: parseFloat(amount), reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: `${data.status ?? 'Failed'}: ${data.error}` });
      } else {
        setResult({
          ok: true,
          message: `Refund of £${(data.amountRefunded ?? parseFloat(amount)).toFixed(2)} succeeded`,
        });
      }
    } catch {
      setResult({ ok: false, message: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, amount, reason]);

  const parsedAmount = parseFloat(amount);
  const valid =
    parsedAmount > 0 && parsedAmount <= maxRefundable + 0.01 && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Refund Booking</h3>
        <p className="text-sm text-gray-500 mb-4">
          Booking {bookingId.substring(0, 8).toUpperCase()} — max refundable £
          {maxRefundable.toFixed(2)}
        </p>
        {result && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
          >
            {result.message}
          </div>
        )}
        {!result?.ok ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (max £{maxRefundable.toFixed(2)})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={maxRefundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="Why is this refund being issued?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!valid || submitting}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Processing…'
                  : `Refund £${parsedAmount > 0 ? parsedAmount.toFixed(2) : '0.00'}`}
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReassignPreview {
  priceCase: 'EQUAL' | 'CHEAPER' | 'PRICIER';
  originalTotal: number;
  newTotal: number;
  diff: number;
  topupAmount?: number;
  refundAmount?: number;
  newCleanerName: string;
  isGuest: boolean;
}

const REASSIGN_ELIGIBLE_STATUSES = [
  'AWAITING_CLEANER',
  'ACCEPTED',
  'CONFIRMED',
  'CASCADE_EXHAUSTED',
];

function ReassignPanel({ booking }: { booking: BookingDetail }) {
  const [newCleanerId, setNewCleanerId] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ReassignPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const eligibleStatus = REASSIGN_ELIGIBLE_STATUSES.includes(booking.status);
  const moneyOk = booking.transferStatus === 'PENDING' || booking.transferStatus === 'FAILED';

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCleanerId: newCleanerId.trim(), dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setPreview(data.preview);
      }
    } catch {
      setError('Network error');
    } finally {
      setPreviewing(false);
    }
  }, [booking.id, newCleanerId]);

  const runReassign = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCleanerId: newCleanerId.trim(), reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const r = data.result as {
        outcome: string;
        priceCase: string;
        topupAmount?: number;
        refundAmount?: number;
        warning?: string;
      };
      let message: string;
      if (r.outcome === 'PROVISIONAL') {
        message = `Top-up approval sent to customer (£${(r.topupAmount ?? 0).toFixed(2)}). Reassign completes when they approve; on decline it reverts to the current cleaner.`;
      } else if (r.priceCase === 'CHEAPER') {
        message = `Reassigned — refunded £${(r.refundAmount ?? 0).toFixed(2)}.${r.warning ? ` ⚠ ${r.warning}` : ''}`;
      } else {
        message = 'Reassigned (equal price).';
      }
      setResult({ ok: true, message });
      setPreview(null);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }, [booking.id, newCleanerId, reason]);

  if (!eligibleStatus) {
    return (
      <Section title="Reassign Cleaner">
        <p className="text-sm text-gray-500">
          Not available for {booking.status} bookings. Eligible:{' '}
          {REASSIGN_ELIGIBLE_STATUSES.join(', ')}.
        </p>
      </Section>
    );
  }

  const caseVariant = (c: string): 'amber' | 'blue' | 'gray' =>
    c === 'PRICIER' ? 'amber' : c === 'CHEAPER' ? 'blue' : 'gray';

  return (
    <Section title="Reassign Cleaner">
      {!moneyOk && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          Transfer status is <span className="font-medium">{booking.transferStatus}</span> —
          reassign is blocked unless PENDING or FAILED.
          {(booking.transferStatus === 'RELEASED' || booking.transferStatus === 'RELEASING') &&
            " Funds already released; handle the old cleaner's payout first."}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            New cleaner (User ID)
          </label>
          <input
            type="text"
            value={newCleanerId}
            onChange={(e) => {
              setNewCleanerId(e.target.value);
              reset();
            }}
            placeholder="cleaner user id"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this booking being reassigned?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
        </div>
        <button
          onClick={runPreview}
          disabled={!newCleanerId.trim() || !moneyOk || previewing}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 rounded-lg border border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {previewing ? 'Checking…' : 'Preview price'}
        </button>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-800">{error}</div>
        )}

        {preview && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">New cleaner</span>
              <span className="font-medium">{preview.newCleanerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Price case</span>
              <StatusBadge status={preview.priceCase} variant={caseVariant(preview.priceCase)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Original → New</span>
              <span>
                £{preview.originalTotal.toFixed(2)} → £{preview.newTotal.toFixed(2)}
              </span>
            </div>
            {preview.priceCase === 'PRICIER' && (
              <p className="text-xs text-amber-700">
                Customer will be asked to approve a £{(preview.topupAmount ?? 0).toFixed(2)} top-up.
                Reassign only completes on approval; on decline it reverts to the current
                cleaner/state. The customer is never force-charged.
              </p>
            )}
            {preview.priceCase === 'CHEAPER' && (
              <p className="text-xs text-blue-700">
                Customer will be refunded £{(preview.refundAmount ?? 0).toFixed(2)} and the swap
                applies immediately.
              </p>
            )}
            {preview.priceCase === 'EQUAL' && (
              <p className="text-xs text-gray-600">
                No customer charge or refund — the swap applies immediately.
              </p>
            )}
            <div className="pt-1">
              <button
                onClick={runReassign}
                disabled={!reason.trim() || submitting}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Reassigning…' : 'Confirm Reassign'}
              </button>
              {!reason.trim() && (
                <span className="ml-2 text-xs text-gray-400">Enter a reason to confirm.</span>
              )}
            </div>
          </div>
        )}

        {result && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
          >
            {result.message}
          </div>
        )}
      </div>
    </Section>
  );
}

export default function BookingDetailClient({ booking: b }: { booking: BookingDetail }) {
  const [showRefund, setShowRefund] = useState(false);
  const [releaseState, setReleaseState] = useState<{
    loading: boolean;
    result: { ok: boolean; message: string } | null;
    confirming: boolean;
  }>({
    loading: false,
    result: null,
    confirming: false,
  });

  const totalRefunded = b.refundRecords
    .filter((r) => r.status === 'SUCCEEDED')
    .reduce((sum, r) => sum + n(r.amount), 0);
  // Refundable is anchored to the ORIGINAL charge — the only PI the refund action
  // touches. Top-ups are charged on separate PIs and refunded via a separate
  // (deferred) action, so they're shown as accounting context, not refundable here.
  const baseCharged = n(b.totalAmountCharged ?? b.totalPrice);
  const topupsCharged = (b.topupRecords ?? [])
    .filter((t) => t.status === 'SUCCEEDED')
    .reduce((sum, t) => sum + n(t.amount), 0);
  const totalCharged = +(baseCharged + topupsCharged).toFixed(2);
  const refundable = Math.max(0, +(baseCharged - totalRefunded).toFixed(2));

  const handleRelease = useCallback(async () => {
    setReleaseState((s) => ({ ...s, loading: true, result: null }));
    try {
      const res = await fetch('/api/admin/release-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: b.id }),
      });
      const data = await res.json();
      const ok = data.status === 'RELEASED' || data.status === 'ALREADY_RELEASED';
      setReleaseState({
        loading: false,
        confirming: false,
        result: {
          ok,
          message: `${data.status}${data.transferId ? ` — ${data.transferId}` : ''}${data.reason ? ` — ${data.reason}` : ''}`,
        },
      });
    } catch {
      setReleaseState({
        loading: false,
        confirming: false,
        result: { ok: false, message: 'Network error' },
      });
    }
  }, [b.id]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin/bookings" className="text-sm text-blue-600 hover:underline">
            &larr; All bookings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Booking {b.id.substring(0, 8).toUpperCase()}
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{b.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={b.status} />
          {b.cascadePhase && <StatusBadge status={b.cascadePhase} variant="amber" />}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {refundable > 0.01 && (
          <button
            onClick={() => setShowRefund(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-700"
          >
            Refund (up to £{refundable.toFixed(2)})
          </button>
        )}
        {b.transferStatus !== 'RELEASED' &&
          b.transferStatus !== 'REFUNDED' &&
          b.transferStatus !== 'PAUSED' && (
            <>
              {releaseState.confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Release £{n(b.cleanerEarnings).toFixed(2)} to cleaner?
                  </span>
                  <button
                    onClick={handleRelease}
                    disabled={releaseState.loading}
                    className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {releaseState.loading ? 'Processing…' : 'Confirm Release'}
                  </button>
                  <button
                    onClick={() => setReleaseState((s) => ({ ...s, confirming: false }))}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setReleaseState((s) => ({ ...s, confirming: true, result: null }))}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700"
                >
                  Release Funds
                </button>
              )}
            </>
          )}
        <ForceCascadeButton booking={b} />
      </div>

      {releaseState.result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${releaseState.result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {releaseState.result.message}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Info */}
        <Section title="Booking">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Service" value={b.serviceType} />
            <Field label="Property Size" value={b.propertySize} />
            <Field label="Date" value={b.date?.split('T')[0]} />
            <Field label="Time" value={b.startTime} />
            <Field label="Duration" value={`${n(b.duration)}h`} />
            <Field label="Frequency" value={b.frequency} />
            <Field label="Extras" value={b.extras.length > 0 ? b.extras.join(', ') : '—'} />
            <Field label="Created" value={fmtDate(b.createdAt)} />
            {b.acceptedAt && <Field label="Accepted" value={fmtDate(b.acceptedAt)} />}
            {b.completedAt && <Field label="Completed" value={fmtDate(b.completedAt)} />}
            {b.cancelledAt && <Field label="Cancelled" value={fmtDate(b.cancelledAt)} />}
          </dl>
          {b.notes && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Notes:</span> {b.notes}
            </div>
          )}
          {b.cleanerNotes && (
            <div className="mt-1 text-sm text-gray-600">
              <span className="font-medium">Cleaner notes:</span> {b.cleanerNotes}
            </div>
          )}
          {b.adminNotes && (
            <div className="mt-1 text-sm text-gray-600">
              <span className="font-medium">Admin notes:</span> {b.adminNotes}
            </div>
          )}
          {b.cancellationReason && (
            <div className="mt-1 text-sm text-red-600">
              <span className="font-medium">Cancellation reason:</span> {b.cancellationReason}
            </div>
          )}
        </Section>

        {/* Pricing */}
        <Section title="Pricing &amp; Payment">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Total Price" value={`£${n(b.totalPrice).toFixed(2)}`} />
            <Field label="Cleaner Earnings" value={`£${n(b.cleanerEarnings).toFixed(2)}`} />
            <Field label="Platform Fee" value={`£${n(b.platformFee).toFixed(2)}`} />
            {topupsCharged > 0 && (
              <Field
                label="Total Charged"
                value={`£${totalCharged.toFixed(2)} (£${baseCharged.toFixed(2)} + £${topupsCharged.toFixed(2)} topup)`}
              />
            )}
            <Field label="Payment Status" value={<StatusBadge status={b.paymentStatus} />} />
            <Field label="Stripe PI" value={b.stripePaymentIntentId || '—'} />
            <Field label="Stripe Charge" value={b.stripeChargeId || '—'} />
            <Field
              label="Total Refunded"
              value={totalRefunded > 0 ? `£${totalRefunded.toFixed(2)}` : '—'}
            />
            <Field
              label="Refundable"
              value={
                refundable > 0
                  ? topupsCharged > 0
                    ? `£${refundable.toFixed(2)} (original PI only — topup refund via separate action)`
                    : `£${refundable.toFixed(2)}`
                  : '—'
              }
            />
          </dl>
          {b.bookingAddons.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Add-ons</p>
              {b.bookingAddons.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{a.addon.name}</span>
                  <span className="text-gray-600">£{a.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {b.payment?.discountPercent && (
            <div className="mt-2 text-sm text-gray-600">
              Discount: {b.payment.discountPercent}% ({b.payment.promoCode})
              {b.payment.discountAmount && ` = £${n(b.payment.discountAmount).toFixed(2)}`}
            </div>
          )}
        </Section>

        {/* Transfer */}
        <Section title="Transfer State">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Transfer Status" value={<StatusBadge status={b.transferStatus} />} />
            <Field label="Transfer ID" value={b.stripeTransferId || '—'} />
            <Field label="Attempt" value={b.transferAttempt} />
            <Field label="Failure Reason" value={b.transferFailureReason} />
            <Field label="Release Due" value={fmtDate(b.releaseDueAt)} />
            <Field label="Completion Confirmed" value={fmtDate(b.completionConfirmedAt)} />
          </dl>
        </Section>

        {/* Cascade */}
        <Section title="Cascade State">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field
              label="Phase"
              value={b.cascadePhase ? <StatusBadge status={b.cascadePhase} /> : '—'}
            />
            <Field label="Primary Expires" value={fmtDate(b.cascadeExpiresAt)} />
            <Field label="Backup Expires" value={fmtDate(b.cascadeBackupExpiresAt)} />
            <Field
              label="Declined By"
              value={b.declinedCleanerIds.length > 0 ? b.declinedCleanerIds.join(', ') : '—'}
            />
            <Field
              label="Backup Cleaners"
              value={b.backupCleanerIds.length > 0 ? `${b.backupCleanerIds.length} assigned` : '—'}
            />
            <Field label="Auto-Assign Backup" value={b.autoAssignBackup ? 'Yes' : 'No'} />
          </dl>
          {b.provisionalCleanerId && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Provisional Acceptance</p>
              <dl className="grid grid-cols-2 gap-x-4">
                <Field label="Provisional Cleaner" value={b.provisionalCleanerId} />
                <Field
                  label="Provisional Price"
                  value={b.provisionalPrice ? `£${n(b.provisionalPrice).toFixed(2)}` : '—'}
                />
                <Field
                  label="Topup Amount"
                  value={b.topupAmount ? `£${n(b.topupAmount).toFixed(2)}` : '—'}
                />
                <Field label="Approval Expires" value={fmtDate(b.approvalExpiresAt)} />
                <Field label="Topup Approved" value={b.topupApproved ? 'Yes' : 'No'} />
              </dl>
            </div>
          )}
        </Section>

        {/* Client */}
        <Section title="Client">
          {b.client ? (
            <dl className="grid grid-cols-2 gap-x-4">
              <Field label="Name" value={b.client.name} />
              <Field label="Email" value={b.client.email} />
              <Field label="Stripe Customer" value={b.client.stripeCustomerId || '—'} />
            </dl>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4">
              <Field label="Guest Name" value={b.guestName} />
              <Field label="Guest Email" value={b.guestEmail} />
              <Field label="Guest Phone" value={b.guestPhone} />
            </dl>
          )}
        </Section>

        {/* Cleaner */}
        <Section title="Cleaner">
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Name" value={b.cleaner.name} />
            <Field label="Email" value={b.cleaner.email} />
            <Field
              label="Stripe Account"
              value={b.cleaner.cleanerProfile?.stripeAccountId || '—'}
            />
            <Field label="Verified" value={b.cleaner.cleanerProfile?.verified ? 'Yes' : 'No'} />
          </dl>
        </Section>

        {/* Address */}
        {b.address && (
          <Section title="Address">
            <p className="text-sm text-gray-900">{b.address.line1}</p>
            {b.address.line2 && <p className="text-sm text-gray-900">{b.address.line2}</p>}
            <p className="text-sm text-gray-900">
              {b.address.city} {b.address.postcode}
            </p>
          </Section>
        )}

        {/* Review */}
        {b.review && (
          <Section title="Review">
            <dl className="grid grid-cols-2 gap-x-4">
              <Field label="Rating" value={`${n(b.review.rating)}/5`} />
              <Field label="Date" value={fmtDate(b.review.createdAt)} />
            </dl>
            {b.review.text && <p className="text-sm text-gray-700 mt-2">{b.review.text}</p>}
            {b.review.reply && (
              <p className="text-sm text-gray-600 mt-1 italic">Reply: {b.review.reply}</p>
            )}
          </Section>
        )}

        {/* Dispute */}
        {b.dispute && (
          <Section title="Dispute">
            <dl className="grid grid-cols-2 gap-x-4">
              <Field label="Status" value={<StatusBadge status={b.dispute.status} />} />
              <Field label="Reason" value={b.dispute.reason} />
              <Field label="Raised" value={fmtDate(b.dispute.createdAt)} />
              {b.dispute.resolvedAt && (
                <Field label="Resolved" value={fmtDate(b.dispute.resolvedAt)} />
              )}
            </dl>
            <p className="text-sm text-gray-700 mt-2">{b.dispute.description}</p>
            {b.dispute.resolution && (
              <p className="text-sm text-green-700 mt-1">Resolution: {b.dispute.resolution}</p>
            )}
            {b.dispute.evidence.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500">
                  Evidence ({b.dispute.evidence.length})
                </p>
                {b.dispute.evidence.map((e) => (
                  <div key={e.id} className="text-sm text-blue-600">
                    {e.fileName || e.type} —{' '}
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Refund Records */}
      {b.refundRecords.length > 0 && (
        <Section title={`Refund Records (${b.refundRecords.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2">Stripe ID</th>
                  <th className="pb-2">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {b.refundRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 text-gray-600">{fmtDate(r.createdAt)}</td>
                    <td className="py-2 font-medium">£{n(r.amount).toFixed(2)}</td>
                    <td className="py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2 text-gray-600 max-w-xs truncate">{r.reason}</td>
                    <td className="py-2 text-xs text-gray-400 font-mono">
                      {r.stripeRefundId || '—'}
                    </td>
                    <td className="py-2 text-red-600 text-xs">{r.failureReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Topup Records */}
      {b.topupRecords.length > 0 && (
        <Section title={`Topup Records (${b.topupRecords.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Stripe PI</th>
                  <th className="pb-2">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {b.topupRecords.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 text-gray-600">{fmtDate(t.createdAt)}</td>
                    <td className="py-2 font-medium">£{n(t.amount).toFixed(2)}</td>
                    <td className="py-2">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-2 text-gray-600">{t.paymentMethodType || '—'}</td>
                    <td className="py-2 text-xs text-gray-400 font-mono">
                      {t.stripePaymentIntentId || '—'}
                    </td>
                    <td className="py-2 text-red-600 text-xs">{t.failureReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Stage 3: Reassign cleaner */}
      <ReassignPanel booking={b} />

      {/* Stage 2: Testing Tools */}
      <StatusOverridePanel booking={b} />

      <Section title="Danger Zone (Dev Only)">
        <DeleteBookingButton booking={b} />
      </Section>

      {showRefund && (
        <RefundModal
          bookingId={b.id}
          maxRefundable={refundable}
          onClose={() => setShowRefund(false)}
        />
      )}
    </div>
  );
}
