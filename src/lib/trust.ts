// Trust & Safety engine — handles identity verification, escrow, and disputes.

import { PLATFORM_COMMISSION_PERCENT } from './pricing';
import type {
  VerificationLevel,
  EscrowTransaction,
  EscrowStatus,
  DisputeStatus,
  DisputeReason,
} from './types';

// ─── Identity Verification ───────────────────────────────────

export function getVerificationLevel(
  idVerified: boolean,
  backgroundChecked: boolean
): VerificationLevel {
  if (idVerified && backgroundChecked) return 'full';
  if (idVerified) return 'basic';
  return 'unverified';
}

export function getVerificationBadge(level: VerificationLevel) {
  switch (level) {
    case 'full':
      return {
        label: 'ID & Background Verified',
        color: 'bg-trust/10 text-trust ring-trust/20',
        icon: 'shield-check',
      };
    case 'basic':
      return {
        label: 'ID Verified',
        color: 'bg-primary-soft text-primary ring-primary/20',
        icon: 'id-card',
      };
    default:
      return {
        label: 'Unverified',
        color: 'bg-page text-ink-3 ring-line',
        icon: 'question',
      };
  }
}

// ─── Escrow ──────────────────────────────────────────────────

// Escrow is used on first-time bookings with a cleaner to protect both parties.
// Payment is held until the job is confirmed complete.

export function shouldUseEscrow(isFirstBookingWithCleaner: boolean): boolean {
  return isFirstBookingWithCleaner;
}

export function createEscrowTransaction(
  bookingId: string,
  totalAmount: number,
  isFirstBooking: boolean
): EscrowTransaction {
  const platformFee = Math.round(totalAmount * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
  const cleanerAmount = Math.round((totalAmount - platformFee) * 100) / 100;

  return {
    id: `esc_${Date.now()}`,
    bookingId,
    amount: totalAmount,
    cleanerAmount,
    platformFee,
    status: 'held',
    heldAt: new Date().toISOString(),
    releaseCondition: isFirstBooking ? 'customer-confirmed' : 'auto-24h',
    isFirstBooking,
  };
}

export function getEscrowStatusLabel(status: EscrowStatus) {
  switch (status) {
    case 'held':
      return { label: 'Payment Held Securely', color: 'text-warning bg-warning/10' };
    case 'released':
      return { label: 'Payment Released to Cleaner', color: 'text-trust bg-trust/10' };
    case 'refunded':
      return { label: 'Payment Refunded', color: 'text-primary bg-primary-soft' };
    case 'disputed':
      return { label: 'Payment Frozen — Dispute Open', color: 'text-danger bg-danger/10' };
    default:
      return { label: 'Direct Payment', color: 'text-ink-3 bg-page' };
  }
}

// Release conditions:
// - First-time booking: customer must confirm satisfaction within 24h, else auto-releases
// - Repeat booking: auto-releases 24h after job marked complete
// - Disputed: frozen until resolution

export function canReleaseEscrow(
  escrow: EscrowTransaction,
  customerConfirmed: boolean,
  hoursElapsed: number
): boolean {
  if (escrow.status !== 'held') return false;

  if (escrow.releaseCondition === 'customer-confirmed') {
    return customerConfirmed || hoursElapsed >= 24;
  }

  if (escrow.releaseCondition === 'auto-24h') {
    return hoursElapsed >= 24;
  }

  return false;
}

// ─── Disputes ────────────────────────────────────────────────

export const DISPUTE_REASONS: { value: DisputeReason; label: string; description: string }[] = [
  {
    value: 'no-show-cleaner',
    label: "Cleaner didn't show up",
    description: 'The cleaner did not arrive at the scheduled time.',
  },
  {
    value: 'no-show-customer',
    label: 'Customer not available',
    description: 'Customer was not home or property was inaccessible.',
  },
  {
    value: 'poor-quality',
    label: 'Quality not as expected',
    description: 'The cleaning did not meet the agreed standard.',
  },
  {
    value: 'property-damage',
    label: 'Property damage',
    description: 'Something was broken or damaged during the cleaning.',
  },
  {
    value: 'incorrect-duration',
    label: 'Incorrect duration',
    description: "The cleaner left early or the time logged doesn't match.",
  },
  {
    value: 'safety-concern',
    label: 'Safety concern',
    description: 'Felt unsafe or experienced inappropriate behavior.',
  },
  {
    value: 'payment-issue',
    label: 'Payment issue',
    description: 'Charged incorrectly or payment not received.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else went wrong.',
  },
];

export function getDisputeStatusLabel(status: DisputeStatus) {
  switch (status) {
    case 'open':
      return { label: 'Open', color: 'bg-warning/10 text-warning' };
    case 'under-review':
      return { label: 'Under Review', color: 'bg-primary-soft text-primary' };
    case 'resolved-customer':
      return { label: 'Resolved — Customer Refunded', color: 'bg-trust/10 text-trust' };
    case 'resolved-cleaner':
      return { label: 'Resolved — Cleaner Paid', color: 'bg-trust/10 text-trust' };
    case 'resolved-split':
      return { label: 'Resolved — Split Payment', color: 'bg-ink/[0.06] text-ink' };
    case 'dismissed':
      return { label: 'Dismissed', color: 'bg-page text-ink-3' };
    case 'escalated':
      return { label: 'Escalated to Support', color: 'bg-danger/10 text-danger' };
    default:
      return { label: status, color: 'bg-page text-ink-3' };
  }
}
