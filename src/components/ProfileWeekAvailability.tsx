// Read-only weekly availability summary for the shared CleanerProfileView (used
// by both the public /cleaners/[id] profile and the cleaner's own /cleaner/preview).
// A1 language: one row per day, "Mon · 8:00 – 17:00" (multiple windows
// comma-separated), a muted "—" for unavailable days. Purely a render of the same
// recurring-slot data — no editor, no logic.

interface Slot {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  startTime: string; // "HH:MM"
  endTime: string;
}

// Mon-first display order.
const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

function fmt(t: string): string {
  const [h, m] = t.split(':');
  return `${Number(h)}:${m}`;
}

export default function ProfileWeekAvailability({ slots }: { slots: Slot[] }) {
  if (!slots || slots.length === 0) {
    return (
      <p className="font-jost text-[14px] font-light text-ink-3">Availability not set yet.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {DAYS.map(({ dow, label }) => {
        const windows = slots
          .filter((s) => s.dayOfWeek === dow)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((s) => `${fmt(s.startTime)} – ${fmt(s.endTime)}`);
        const available = windows.length > 0;
        return (
          <div key={dow} className="flex items-baseline gap-3 font-jost text-[13px]">
            <span className="w-9 shrink-0 font-medium uppercase tracking-[0.08em] text-ink-3">
              {label}
            </span>
            {available ? (
              <span className="text-ink-2">{windows.join(', ')}</span>
            ) : (
              <span className="text-ink-3/50">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
