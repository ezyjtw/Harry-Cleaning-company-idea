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
        color: 'bg-green-50 text-green-700 ring-green-200',
        icon: 'shield-check',
      };
    case 'basic':
      return {
        label: 'ID Verified',
        color: 'bg-blue-50 text-blue-700 ring-blue-200',
        icon: 'id-card',
      };
    default:
      return {
        label: 'Unverified',
        color: 'bg-gray-50 text-gray-500 ring-gray-200',
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
      return { label: 'Payment Held in Escrow', color: 'text-amber-600 bg-amber-50' };
    case 'released':
      return { label: 'Payment Released to Cleaner', color: 'text-green-600 bg-green-50' };
    case 'refunded':
      return { label: 'Payment Refunded', color: 'text-blue-600 bg-blue-50' };
    case 'disputed':
      return { label: 'Payment Frozen — Dispute Open', color: 'text-red-600 bg-red-50' };
    default:
      return { label: 'Direct Payment', color: 'text-gray-600 bg-gray-50' };
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
      return { label: 'Open', color: 'bg-yellow-50 text-yellow-700' };
    case 'under-review':
      return { label: 'Under Review', color: 'bg-blue-50 text-blue-700' };
    case 'resolved-customer':
      return { label: 'Resolved — Customer Refunded', color: 'bg-green-50 text-green-700' };
    case 'resolved-cleaner':
      return { label: 'Resolved — Cleaner Paid', color: 'bg-green-50 text-green-700' };
    case 'resolved-split':
      return { label: 'Resolved — Split Payment', color: 'bg-purple-50 text-purple-700' };
    case 'escalated':
      return { label: 'Escalated to Support', color: 'bg-red-50 text-red-700' };
    default:
      return { label: status, color: 'bg-gray-50 text-gray-700' };
  }
}

