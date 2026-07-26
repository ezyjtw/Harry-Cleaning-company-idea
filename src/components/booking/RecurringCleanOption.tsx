'use client';

// R1-A: the customer's "Make it a regular clean" entry. Renders ONLY when the
// chosen date+time falls inside a weekly slot the cleaner has explicitly
// opened to regular clients (recurringEligible) — the server re-validates the
// same rule at booking time, so this surface can never promise what the API
// would refuse. Shared by the cleaner-first wizard (/book/[id]) and the
// service flows (/services/[category]).

import { useEffect, useState } from 'react';

export type RecurringFrequency = '' | 'WEEKLY' | 'FORTNIGHTLY';

interface EligibleSlot {
  dayOfWeek: number;
  start: string;
  end: string;
}

export default function RecurringCleanOption({
  cleanerId,
  cleanerName,
  date,
  time24,
  value,
  onChange,
}: {
  cleanerId: string | null | undefined;
  cleanerName?: string | null;
  date: string; // 'YYYY-MM-DD' or ''
  time24: string; // 'HH:MM' or ''
  value: RecurringFrequency;
  onChange: (v: RecurringFrequency) => void;
}) {
  const [slots, setSlots] = useState<EligibleSlot[] | null>(null);

  useEffect(() => {
    setSlots(null);
    if (!cleanerId || cleanerId === 'auto-assign') return;
    fetch(`/api/cleaners/${cleanerId}/recurring-slots`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSlots(data?.slots ?? []))
      .catch(() => setSlots([]));
  }, [cleanerId]);

  const eligible = (() => {
    if (!date || !time24 || !slots || slots.length === 0) return false;
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return slots.some((s) => s.dayOfWeek === dow && s.start <= time24 && s.end > time24);
  })();

  // A move to a non-eligible slot silently drops the choice — the booking POST
  // must never carry a frequency the server would reject.
  useEffect(() => {
    if (!eligible && value) onChange('');
  }, [eligible, value, onChange]);

  if (!eligible) return null;

  return (
    <div className="p-4" style={{ border: '0.5px solid #E4E9F0' }} data-testid="recurring-option">
      <p className="font-jost text-sm text-ink">Make it a regular clean?</p>
      <p className="mt-0.5 font-jost text-[12px] font-light text-ink-3">
        {cleanerName || 'This cleaner'} offers this slot to regular clients. You pay for
        today&apos;s clean now — each future clean is confirmed and paid closer to the date. No
        lock-in: you can end it any time.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { value: '', label: 'Just once' },
            { value: 'WEEKLY', label: 'Weekly' },
            { value: 'FORTNIGHTLY', label: 'Every two weeks' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 font-jost text-sm transition ${
              value === opt.value ? 'bg-primary text-white' : 'bg-page text-ink-2 hover:text-ink'
            }`}
            style={{ border: '0.5px solid #E4E9F0' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
