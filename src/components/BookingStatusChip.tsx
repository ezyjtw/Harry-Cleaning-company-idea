// Shared booking-status chip — the single source of truth for the customer-facing
// status grammar. Extracted from account/bookings so /booking/[id] and the list
// render identical chips. Semantic mapping: warning (amber) = attention,
// trust (green) = confirmed, primary-soft (navy) = completed, danger (red) =
// failed/disputed, neutral = cancelled.

export type BookingStatus =
  | 'Pending'
  | 'Payment incomplete'
  | 'Waiting for cleaner to confirm'
  | 'Finding your cleaner'
  | 'Our team is on it'
  | 'Price approval needed'
  | 'Confirmed'
  | 'On the way'
  | 'Completed'
  | 'Cancelled'
  | 'Under review'
  | 'No cleaner available'
  | 'Cleaner cancelled — action needed';

export const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-warning/10 text-warning border-warning/20',
  // H53: an unpaid booking (status still PENDING) reads honestly — the customer
  // must know payment didn't complete, not see a reassuring "we're on it".
  'Payment incomplete': 'bg-danger/10 text-danger border-danger/20',
  'Waiting for cleaner to confirm': 'bg-warning/10 text-warning border-warning/20',
  'Finding your cleaner': 'bg-warning/10 text-warning border-warning/20',
  'Our team is on it': 'bg-primary-soft text-primary border-primary/15',
  'Price approval needed': 'bg-warning/10 text-warning border-warning/20',
  Confirmed: 'bg-trust/10 text-trust border-trust/20',
  // 4.6: one customer-visible "On the way" moment (amber), then green complete.
  'On the way': 'bg-warning/10 text-warning border-warning/20',
  Completed: 'bg-trust/10 text-trust border-trust/20',
  Cancelled: 'bg-page text-ink-3 border-line',
  // H60 (James-ruled): a disputed booking wears an AMBER "Under review", not a
  // red accusation — it stays in the completed list while the case runs.
  'Under review': 'bg-warning/10 text-warning border-warning/20',
  'No cleaner available': 'bg-danger/10 text-danger border-danger/20',
  'Cleaner cancelled — action needed': 'bg-danger/10 text-danger border-danger/20',
};

/** Collapse a raw API status (+ cascade phase) into the customer-facing label.
 *  X1: the cascade phases collapse into three HONEST states — waiting on the
 *  chosen cleaner / actively finding alternatives / our team personally on it —
 *  never a bare "Pending" while Rena is actively working the booking. */
export function mapStatus(apiStatus: string, cascadePhase?: string | null): BookingStatus {
  const s = apiStatus.toUpperCase();
  // F6a: a reaped never-paid booking reads with the same honest H53 label an
  // unpaid PENDING row already wears — no new visual language.
  if (s === 'ABANDONED') return 'Payment incomplete';
  if (s === 'AWAITING_CLEANER') {
    switch (cascadePhase) {
      case 'PRIMARY_OFFER':
        return 'Waiting for cleaner to confirm';
      case 'BACKUP_OFFER':
      case 'COMBINED_OFFER':
      case 'PHASE2_RESERVE':
        return 'Finding your cleaner';
      case 'RENA_FIND':
      case 'RENA_FIND_ADMIN_REVIEW':
        return 'Our team is on it';
      case 'PROVISIONAL_APPROVAL':
        return 'Price approval needed';
      default:
        return 'Pending';
    }
  }
  switch (s) {
    case 'PENDING':
      // H53: a booking is only ever status=PENDING while its payment is
      // incomplete — the payment-success webhook flips it to AWAITING_CLEANER.
      // So PENDING at rest = the customer never finished paying. Say so.
      return 'Payment incomplete';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'Confirmed';
    // X2/4.6: day-of states rendered honestly — EN_ROUTE and IN_PROGRESS are
    // one customer-visible moment (parity with the guest timeline).
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'On the way';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'DISPUTED':
      return 'Under review';
    case 'CASCADE_EXHAUSTED':
      return 'No cleaner available';
    case 'CLEANER_CANCELLED':
      return 'Cleaner cancelled — action needed';
    default:
      return 'Pending';
  }
}

/** The semantic status chip. Pass a raw API status; it collapses + styles it. */
export default function BookingStatusChip({
  rawStatus,
  cascadePhase,
  className,
}: {
  rawStatus: string;
  cascadePhase?: string | null;
  className?: string;
}) {
  const status = mapStatus(rawStatus, cascadePhase);
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]} ${className ?? ''}`}
    >
      {status}
    </span>
  );
}

/** X1: the named, full-sentence version for detail surfaces (booking page,
 *  guest timeline, account home card). Copy is James-signed — keep in sync
 *  with mapStatus above. */
export function cascadeSentence(
  cascadePhase: string | null | undefined,
  cleanerName?: string | null
): string | null {
  switch (cascadePhase) {
    case 'PRIMARY_OFFER':
      return `Waiting for ${cleanerName || 'your cleaner'} to confirm — we'll let you know the moment they do.`;
    case 'BACKUP_OFFER':
    case 'COMBINED_OFFER':
    case 'PHASE2_RESERVE':
      return "Finding your cleaner — we're contacting great alternatives now. Your booking and payment are unchanged.";
    case 'RENA_FIND':
    case 'RENA_FIND_ADMIN_REVIEW':
      return "Our team is personally finding you a cleaner. If we can't find the right person in time, you'll be refunded in full automatically.";
    default:
      return null;
  }
}
