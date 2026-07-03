// Shared cleaner-portal status chip. The cleaner job lifecycle is a different
// grammar from the customer BookingStatusChip (which collapses EN_ROUTE /
// IN_PROGRESS into "Confirmed" and has no offer states), so the portal keeps its
// own status map — but in ONE place, with semantic-token styling, used by both
// the jobs page and the dashboard.

export interface CleanerChipInput {
  /** Raw API status (any case), e.g. 'AWAITING_CLEANER', 'accepted', 'EN_ROUTE'. */
  status: string;
  cascadePhase?: string | null;
  isPrimary?: boolean;
  isProvisional?: boolean;
  isReserve?: boolean;
}

export interface CleanerChip {
  label: string;
  className: string;
}

const NEUTRAL = 'bg-page text-ink-3';
const WARNING = 'bg-warning/10 text-warning';
const TRUST = 'bg-trust/10 text-trust';
const INFO = 'bg-primary-soft text-primary';
const DANGER = 'bg-danger/10 text-danger';

/** Resolve a cleaner job to its portal status chip (label + semantic classes). */
export function cleanerJobChip(job: CleanerChipInput): CleanerChip {
  if (job.isProvisional) return { label: 'Awaiting approval', className: WARNING };
  if (job.isReserve) return { label: 'In reserve', className: NEUTRAL };
  if (
    job.cascadePhase === 'BACKUP_OFFER' ||
    (job.cascadePhase === 'COMBINED_OFFER' && !job.isPrimary)
  ) {
    return { label: 'Backup offer', className: INFO };
  }
  if (job.cascadePhase === 'CASCADE_EXHAUSTED') return { label: 'Expired', className: DANGER };

  switch (job.status.toUpperCase()) {
    case 'AWAITING_CLEANER':
      return { label: 'New offer', className: WARNING };
    case 'PENDING':
    case 'CONFIRMED':
      return { label: 'Pending', className: NEUTRAL };
    case 'ACCEPTED':
      return { label: 'Accepted', className: TRUST };
    case 'EN_ROUTE':
      return { label: 'En route', className: INFO };
    case 'IN_PROGRESS':
      return { label: 'In progress', className: INFO };
    case 'COMPLETED':
    case 'REVIEWED':
      return { label: 'Completed', className: INFO };
    default:
      return { label: 'Pending', className: NEUTRAL };
  }
}

/** The chip element. Pass the raw job fields; it maps + styles them. */
export default function CleanerStatusChip({
  className,
  ...job
}: CleanerChipInput & { className?: string }) {
  const chip = cleanerJobChip(job);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${chip.className} ${className ?? ''}`}
    >
      {chip.label}
    </span>
  );
}
