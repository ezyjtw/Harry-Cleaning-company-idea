// Shared booking-status chip — the single source of truth for the customer-facing
// status grammar. Extracted from account/bookings so /booking/[id] and the list
// render identical chips. Semantic mapping: warning (amber) = attention,
// trust (green) = confirmed, primary-soft (navy) = completed, danger (red) =
// failed/disputed, neutral = cancelled.

export type BookingStatus =
  | 'Pending'
  | 'Finding a cleaner'
  | 'Price approval needed'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Disputed'
  | 'No cleaner available'
  | 'Cleaner cancelled — action needed';

export const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-warning/10 text-warning border-warning/20',
  'Finding a cleaner': 'bg-warning/10 text-warning border-warning/20',
  'Price approval needed': 'bg-warning/10 text-warning border-warning/20',
  Confirmed: 'bg-trust/10 text-trust border-trust/20',
  Completed: 'bg-primary-soft text-primary border-primary/15',
  Cancelled: 'bg-page text-ink-3 border-line',
  Disputed: 'bg-danger/10 text-danger border-danger/20',
  'No cleaner available': 'bg-danger/10 text-danger border-danger/20',
  'Cleaner cancelled — action needed': 'bg-danger/10 text-danger border-danger/20',
};

/** Collapse a raw API status (+ cascade phase) into the customer-facing label. */
export function mapStatus(apiStatus: string, cascadePhase?: string | null): BookingStatus {
  const s = apiStatus.toUpperCase();
  if (s === 'AWAITING_CLEANER' && cascadePhase === 'PROVISIONAL_APPROVAL') {
    return 'Price approval needed';
  }
  if (s === 'AWAITING_CLEANER' && cascadePhase === 'BACKUP_OFFER') {
    return 'Finding a cleaner';
  }
  switch (s) {
    case 'PENDING':
    case 'AWAITING_CLEANER':
      return 'Pending';
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
      return 'Confirmed';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'DISPUTED':
      return 'Disputed';
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
