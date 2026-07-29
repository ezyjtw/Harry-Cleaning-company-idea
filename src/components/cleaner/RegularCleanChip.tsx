// F24.1 (James-ruled): a recurring occurrence must be VISIBLY recurring on
// every cleaner surface, with its frequency. This chip is a SIBLING of the
// status chip (a recurring job is also Accepted/On-the-way/…), reusing the
// exact CleanerStatusChip geometry with the INFO tone. House dialect for
// frequency: "Weekly" / "Every two weeks" — never "fortnightly" in UI copy.

export function recurringFrequencyLabel(frequency: string): string {
  return frequency === 'WEEKLY' ? 'Weekly' : 'Every two weeks';
}

export default function RegularCleanChip({
  frequency,
  className,
}: {
  frequency: string | null | undefined;
  className?: string;
}) {
  if (!frequency) return null;
  return (
    <span
      data-testid="regular-clean-chip"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] bg-primary-soft text-primary ${className ?? ''}`}
    >
      Regular clean · {recurringFrequencyLabel(frequency)}
    </span>
  );
}
