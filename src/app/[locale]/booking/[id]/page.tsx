'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import BookingStatusChip, { cascadeSentence } from '@/components/BookingStatusChip';
import CleanerAvatar from '@/components/CleanerAvatar';
import NavLink from '@/components/nav/NavLink';
import RegularCleanOfferCard from '@/components/RegularCleanOfferCard';
import RescuePanel from '@/components/RescuePanel';
import UnpaidOccurrencePanel from '@/components/UnpaidOccurrencePanel';
import { bookingCloseState } from '@/lib/booking/close-state';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import { DISPUTE_REASONS } from '@/lib/trust';
import { formatDate } from '@/lib/utils/formatting';

// H40: statuses where "Report a problem" may be filed. Mirrors
// DISPUTABLE_STATUS in dispute.service.ts (the server enforces it regardless —
// this only controls whether the door renders).
const DISPUTABLE_STATUSES = ['COMPLETED', 'EN_ROUTE', 'IN_PROGRESS', 'REVIEWED'];

// #5: customer job-detail view. Data + access control come entirely from the
// existing ownership-gated GET /api/bookings/[id] (clientId/cleaner/backup/admin
// only) — this page adds NO new route and no new access logic.

interface BookingDetail {
  id: string;
  serviceType: string;
  status: string;
  /** H8: who is looking — rescue choices are the customer's alone. */
  viewer?: 'client' | 'cleaner' | 'backup' | 'admin';
  paymentStatus?: string | null;
  /** R1-C: present on recurring occurrences — selects the no-charge variant. */
  agreementId?: string | null;
  cascadePhase?: string | null;
  date: string;
  startTime: string;
  duration: number | string;
  totalPrice: number | string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressPostcode?: string | null;
  address?: { line1?: string; line2?: string; city?: string; postcode?: string } | null;
  rescueDeadline?: string | null;
  /** H57: pending price-change fields — live while cascadePhase is PROVISIONAL_APPROVAL. */
  topupAmount?: number | string | null;
  provisionalPrice?: number | string | null;
  approvalExpiresAt?: string | null;
  backupCleanerIds?: string[];
  notes?: string | null;
  dispute?: { id: string } | null;
  transferStatus?: string | null;
  completionConfirmedAt?: string | null;
  releaseDueAt?: string | null;
  cleaner: {
    id: string;
    name: string | null;
    image: string | null;
    cleanerProfile?: { rating: number | string | null } | null;
  } | null;
}

type LoadState = 'loading' | 'ok' | 'unauth' | 'forbidden' | 'notfound' | 'error';

export default function BookingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id || '');
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  // H40: the "Report a problem" door — the completion notification and the
  // FAQ both send customers HERE to report, but this page never had the door.
  // Same inline form + POST as /account/bookings; success lands on /disputes
  // where evidence (photos) is added and both sides see the case.
  const [reporting, setReporting] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // H57 addendum: the pending price change is actionable RIGHT HERE — the
  // email/banner/card all also lead to the standalone approve page, but the
  // detail page mustn't make the customer hunt for the door.
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const actOnPriceChange = async (action: 'approve' | 'decline') => {
    setApprovalBusy(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/approve-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.result === 'requires_payment') {
        // Card entry needed — the standalone page hosts the Stripe element.
        window.location.href = `/booking/${id}/approve-topup`;
        return;
      }
      if (!res.ok) {
        setApprovalError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      window.location.reload();
    } catch {
      setApprovalError('Network error. Please try again.');
    } finally {
      setApprovalBusy(false);
    }
  };

  // H42: "Confirm & release payment" — the completion notification promises
  // this action on this page; the machinery (confirm-complete → releaseDueAt
  // now, scheduler releases) existed but only /account/bookings had the door.
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ ok: boolean; message: string } | null>(null);

  const confirmComplete = async () => {
    setConfirming(true);
    setConfirmResult(null);
    try {
      const res = await fetch(`/api/bookings/${id}/confirm-complete`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBooking((prev) =>
          prev ? { ...prev, completionConfirmedAt: new Date().toISOString() } : prev
        );
        setConfirmResult({
          ok: true,
          message: data.message || 'Confirmed — payment will be released to your cleaner shortly.',
        });
      } else {
        setConfirmResult({ ok: false, message: data.error || 'Could not confirm completion.' });
      }
    } catch {
      setConfirmResult({ ok: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setConfirming(false);
    }
  };

  const submitDispute = async () => {
    setSubmittingDispute(true);
    setDisputeError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason, description: disputeDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisputeError(data.error || 'Failed to submit report.');
        return;
      }
      // F9 pattern: photos/evidence strengthen the claim — take them straight
      // to the dispute case.
      window.location.href = '/disputes';
    } catch {
      setDisputeError('Network error. Please try again.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${id}`);
        if (res.status === 401) return setState('unauth');
        if (res.status === 403) return setState('forbidden');
        if (res.status === 404) return setState('notfound');
        if (!res.ok) return setState('error');
        setBooking(await res.json());
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-line" />
          <div className="h-40 rounded-2xl bg-line" />
        </div>
      </div>
    );
  }

  if (state !== 'ok' || !booking) {
    const copy: Record<Exclude<LoadState, 'loading' | 'ok'>, { title: string; body: string }> = {
      unauth: { title: 'Please sign in', body: 'Sign in to view this booking.' },
      forbidden: { title: 'No access', body: "This booking isn't associated with your account." },
      notfound: { title: 'Not found', body: 'We couldn’t find that booking.' },
      error: { title: 'Something went wrong', body: 'Please try again in a moment.' },
    };
    const c = copy[state as Exclude<LoadState, 'loading' | 'ok'>] ?? copy.error;
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-newsreader text-[22px] font-semibold text-ink">{c.title}</h1>
          <p className="mt-2 font-jost text-[14px] text-ink-3">{c.body}</p>
          <Link
            href={state === 'unauth' ? `/login?callbackUrl=/booking/${id}` : '/account/bookings'}
            className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-2.5 font-jost text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {state === 'unauth' ? 'Sign in' : 'My bookings'}
          </Link>
        </div>
      </div>
    );
  }

  const cleaner = booking.cleaner;
  const rating = cleaner?.cleanerProfile?.rating;
  const address = [
    booking.addressLine1 ?? booking.address?.line1,
    booking.addressLine2 ?? booking.address?.line2,
    booking.addressCity ?? booking.address?.city,
    booking.addressPostcode ?? booking.address?.postcode,
  ]
    .filter(Boolean)
    .join(', ');

  // F16: whole hours until the auto-release clock fires (null when the clock
  // isn't armed or has already passed — copy falls back to the generic line).
  const releaseEtaMs = booking.releaseDueAt
    ? new Date(booking.releaseDueAt).getTime() - Date.now()
    : 0;
  const releaseEtaHours = releaseEtaMs > 0 ? Math.max(1, Math.ceil(releaseEtaMs / 3600_000)) : null;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="font-jost text-[13px] text-ink-3">{label}</span>
      <span className="text-right font-jost text-[14px] font-medium text-ink">{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <NavLink
        surface="booking-detail-back"
        href="/account"
        className="font-jost text-[12px] uppercase tracking-[0.1em] text-primary hover:underline"
      >
        ← Back to my account
      </NavLink>

      {/* H8: the rescue choice belongs to the CUSTOMER. Other authorized
          viewers (the cleaner — including the canceller — backups, admin) get
          an informational state, never the actionable panel. The POST refuses
          them regardless; this stops the page presenting a choice that isn't
          theirs. */}
      {booking.status === 'CLEANER_CANCELLED' && booking.viewer !== 'client' && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {booking.viewer === 'admin' ? 'Awaiting customer choice' : 'For the customer'}
          </p>
          <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
            {booking.viewer === 'admin'
              ? 'The customer is choosing what happens next'
              : 'This link is for the customer'}
          </h2>
          <p className="mt-2 font-jost text-sm text-ink-2">
            {booking.viewer === 'admin'
              ? 'They can keep the slot with another cleaner, rebook a new date, or take a full refund. If they make no choice by the deadline, the full refund fires automatically. Read-only here.'
              : 'This booking was cancelled by its cleaner, and the customer has been asked to choose what happens next. There is nothing to action on this page.'}
          </p>
          {booking.rescueDeadline && (
            <p className="mt-2 font-jost text-[13px] text-ink-3">
              Auto-refund deadline: {new Date(booking.rescueDeadline).toLocaleString('en-GB')}
            </p>
          )}
        </div>
      )}

      {/* H57 addendum: pending price change — inline approve/decline for the
          booking's customer. Same POST as the standalone approve page; card
          entry (no saved card) hands over to that page's Stripe element. */}
      {booking.viewer === 'client' && booking.cascadePhase === 'PROVISIONAL_APPROVAL' && (
        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/[0.06] p-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">
            Action needed
          </p>
          <h2 className="mt-1 font-newsreader text-xl font-semibold text-ink">
            A price change of +£{Number(booking.topupAmount ?? 0).toFixed(2)} needs your review
          </h2>
          <p className="mt-2 font-jost text-sm text-ink-2">
            New total: £{Number(booking.provisionalPrice ?? booking.totalPrice).toFixed(2)} (was £
            {Number(booking.totalPrice).toFixed(2)}). Nothing is charged unless you approve —
            decline or do nothing and the booking stands at its original price.
            {booking.approvalExpiresAt &&
              ` You have until ${new Date(booking.approvalExpiresAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} to decide.`}
          </p>
          {approvalError && (
            <p className="mt-2 font-jost text-[13px] text-danger">{approvalError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => actOnPriceChange('approve')}
              disabled={approvalBusy}
              className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {approvalBusy ? 'Working…' : 'Approve & pay the difference'}
            </button>
            <button
              onClick={() => actOnPriceChange('decline')}
              disabled={approvalBusy}
              className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[13px] font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* M3 rescue: cleaner cancelled — the customer's refund/rebook choice */}
      {/* R1-C: an UNPAID occurrence's can't-make gets the no-charge variant —
          reschedule with the same cleaner or skip; the paid rescue keeps the
          full three-way panel below, untouched. */}
      {booking.status === 'CLEANER_CANCELLED' &&
        booking.viewer === 'client' &&
        booking.agreementId &&
        booking.paymentStatus !== 'SUCCEEDED' && (
          <div className="mt-4">
            <UnpaidOccurrencePanel
              bookingId={booking.id}
              cleanerName={booking.cleaner?.name ?? null}
              date={booking.date.split('T')[0]}
              time={booking.startTime}
              onResolved={() => window.location.reload()}
            />
          </div>
        )}
      {booking.status === 'CLEANER_CANCELLED' &&
        booking.viewer === 'client' &&
        !(booking.agreementId && booking.paymentStatus !== 'SUCCEEDED') && (
          <div className="mt-4">
            <RescuePanel
              bookingId={booking.id}
              serviceType={booking.serviceType}
              date={booking.date.split('T')[0]}
              time={booking.startTime}
              duration={Number(booking.duration)}
              postcode={booking.addressPostcode || booking.address?.postcode || ''}
              totalPrice={Number(booking.totalPrice)}
              cancellerId={booking.cleaner?.id ?? null}
              cancellerName={booking.cleaner?.name ?? null}
              backupCleanerIds={booking.backupCleanerIds}
              rescueDeadline={booking.rescueDeadline}
              initialAction={searchParams.get('rescue')}
              onResolved={() => window.location.reload()}
            />
          </div>
        )}

      <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
        {/* Cleaner */}
        <div className="flex items-center gap-3">
          {/* H22 sweep: hand-rolled img/initials pair → the shared avatar (same
              photo-or-initial behaviour, plus its broken-image fallback). */}
          <CleanerAvatar
            photo={cleaner?.image}
            name={cleaner?.name || 'C'}
            size={48}
            className="shrink-0"
          />
          <div>
            <p className="font-jost text-[15px] font-medium text-ink">
              {cleaner?.name || 'Assigned cleaner'}
            </p>
            {Number(rating) > 0 && (
              <p className="font-jost text-[12px] text-ink-3">
                <span className="text-rating">★</span> {Number(rating).toFixed(1)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-line">
          <Row label="Service" value={serviceLabelFromSlug(booking.serviceType)} />
          <Row
            label="Status"
            value={
              <BookingStatusChip rawStatus={booking.status} cascadePhase={booking.cascadePhase} />
            }
          />
          {booking.status === 'AWAITING_CLEANER' &&
            cascadeSentence(booking.cascadePhase, cleaner?.name) && (
              <p className="py-2 font-jost text-[13px] text-primary">
                {cascadeSentence(booking.cascadePhase, cleaner?.name)}
              </p>
            )}
          <Row label="Date" value={formatDate(booking.date, 'full')} />
          <Row label="Time" value={`${booking.startTime} · ${Number(booking.duration)}h`} />
          {address && <Row label="Address" value={address} />}
          <Row label="Total" value={`£${Number(booking.totalPrice).toFixed(2)}`} />
        </div>

        {booking.notes && (
          <div className="mt-4 rounded-[10px] border border-line bg-page px-4 py-3">
            <p className="font-jost text-[12px] text-ink-3">Notes</p>
            <p className="mt-1 font-jost text-[14px] text-ink">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* H42 + F16: confirm-release door — customer only, funds still HOLDABLE
          (that's the whole predicate: transferStatus PENDING and not yet
          confirmed), no dispute. F16 fix: the old status==='COMPLETED' gate
          made the button vanish when a REVIEW flipped the booking to REVIEWED
          while funds were still held — review and release are independent
          axes, so the door now keys on money-state truth alone and disappears
          the instant funds release by ANY path. Release logic unchanged. */}
      {booking.viewer === 'client' &&
        (booking.status === 'COMPLETED' || booking.status === 'REVIEWED') &&
        booking.transferStatus === 'PENDING' &&
        !booking.completionConfirmedAt &&
        !booking.dispute && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="font-jost text-[14px] font-medium text-ink">
              {booking.status === 'REVIEWED' ? 'Thanks for your review!' : 'Happy with your clean?'}
            </p>
            <p className="mt-1 font-jost text-[13px] text-ink-2">
              {booking.status === 'REVIEWED'
                ? `Payment releases automatically${releaseEtaHours ? ` in about ${releaseEtaHours}h` : ' after the completion hold'} — or release it to your cleaner now.`
                : 'Confirm you’re satisfied and we’ll release payment to your cleaner right away. If you do nothing, it releases automatically after the completion hold (24 hours for a first booking).'}
            </p>
            {confirmResult && !confirmResult.ok && (
              <p className="mt-2 font-jost text-[13px] text-danger">{confirmResult.message}</p>
            )}
            <button
              onClick={confirmComplete}
              disabled={confirming}
              className="mt-3 rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm & release payment'}
            </button>
          </div>
        )}
      {booking.viewer === 'client' && confirmResult?.ok && (
        <div className="mt-4 rounded-2xl border border-trust/30 bg-green-50 p-5">
          <p className="font-jost text-[14px] font-medium text-trust">{confirmResult.message}</p>
        </div>
      )}

      {/* F16: honest close-state line. CLOSED needs BOTH — funds released AND
          review left, in either order; the partial states say exactly which
          half is outstanding. Derived from the two truths, no new state. */}
      {booking.viewer === 'client' &&
        !booking.dispute &&
        bookingCloseState(booking) === 'released-awaiting-review' && (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="font-jost text-[14px] font-medium text-ink">
              Payment released — awaiting your review
            </p>
            <p className="mt-1 font-jost text-[13px] text-ink-2">
              Your cleaner has been paid. Leaving a review closes this booking off and helps the
              next customer choose.
            </p>
          </div>
        )}
      {booking.viewer === 'client' && bookingCloseState(booking) === 'closed' && (
        <div className="mt-4 rounded-2xl border border-trust/30 bg-green-50 p-5">
          <p className="font-jost text-[14px] font-medium text-trust">
            All done — payment released and your review is in
          </p>
        </div>
      )}

      {/* R1-A (amended): post-completion regular-clean offer — the card
          self-gates on the offer endpoint (completed + open slots + no active
          agreement), so it renders nothing for anyone else. */}
      {booking.viewer === 'client' &&
        (booking.status === 'COMPLETED' || booking.status === 'REVIEWED') && (
          <RegularCleanOfferCard bookingId={id} className="mt-4" />
        )}

      {/* H40: report-a-problem door — customer only, work happened/happening,
          no dispute already open. The friendly label stays; the flow behind it
          is the real dispute machinery (pauses payment, notifies the cleaner,
          lands in the admin queue). */}
      {booking.viewer === 'client' && booking.dispute && (
        <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/[0.06] p-5">
          <p className="font-jost text-[14px] font-medium text-ink">
            A problem has been reported on this booking
          </p>
          <p className="mt-1 font-jost text-[13px] text-ink-2">
            Our team is reviewing it. You can add photos and follow the case on your disputes page.
          </p>
          <Link
            href="/disputes"
            className="mt-3 inline-flex items-center justify-center rounded-[10px] border border-warning/40 px-4 py-2 font-jost text-[13px] font-medium text-warning transition-colors hover:bg-warning/[0.08]"
          >
            View the case
          </Link>
        </div>
      )}
      {booking.viewer === 'client' &&
        !booking.dispute &&
        DISPUTABLE_STATUSES.includes(booking.status) &&
        (reporting ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-warning/25 bg-warning/[0.06] p-5">
            <span className="font-jost text-[14px] font-medium text-ink">
              Report a problem with this booking
            </span>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a reason…</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={disputeDescription}
              onChange={(e) => setDisputeDescription(e.target.value)}
              placeholder="Please describe the problem…"
              maxLength={2000}
              className="resize-none rounded-[10px] border border-line bg-surface px-3 py-2 font-jost text-[13px] text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="font-jost text-[12px] text-ink-3">
              Reporting a problem pauses payment to your cleaner while we look into it. You can add
              photos on the next page.
            </p>
            {disputeError && (
              <span className="font-jost text-[12px] text-danger">{disputeError}</span>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={submitDispute}
                disabled={submittingDispute || !disputeReason || !disputeDescription.trim()}
                className="rounded-[10px] bg-warning px-4 py-2 font-jost text-[13px] font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
              >
                {submittingDispute ? 'Submitting…' : 'Submit report'}
              </button>
              <button
                onClick={() => {
                  setReporting(false);
                  setDisputeError(null);
                }}
                disabled={submittingDispute}
                className="rounded-[10px] border border-line bg-surface px-4 py-2 font-jost text-[13px] font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={() => setReporting(true)}
              className="rounded-[10px] border border-warning/40 px-4 py-2 font-jost text-[13px] font-medium text-warning transition-colors hover:bg-warning/[0.08]"
            >
              Report a problem
            </button>
          </div>
        ))}
    </div>
  );
}
