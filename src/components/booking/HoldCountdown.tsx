'use client';

import { useEffect, useState } from 'react';

// R10 Lane 1 (James-ruled): the live countdown to a hold's release moment.
// Pure display: ticks every second toward `until`; when the moment passes it
// says so honestly and the page's own data catches up on refresh. Used by
// both ruled windows (the top-up approval hold and the unpaid-occurrence
// hold). Copy stays dash-free.

function remaining(untilMs: number): string | null {
  const ms = untilMs - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function HoldCountdown({
  until,
  prefix,
  closedText,
}: {
  /** ISO instant of the release moment. */
  until: string;
  /** Text before the ticking figure, e.g. "Your slot is held for another". */
  prefix: string;
  /** Honest line once the moment has passed. */
  closedText: string;
}) {
  const untilMs = new Date(until).getTime();
  const [left, setLeft] = useState<string | null>(() => remaining(untilMs));

  useEffect(() => {
    const t = setInterval(() => setLeft(remaining(untilMs)), 1000);
    return () => clearInterval(t);
  }, [untilMs]);

  if (Number.isNaN(untilMs)) return null;
  if (left === null) {
    return (
      <span className="font-jost text-[13px] font-medium text-ink-2" data-testid="hold-countdown">
        {closedText}
      </span>
    );
  }
  return (
    <span className="font-jost text-[13px] font-medium text-primary" data-testid="hold-countdown">
      {prefix} <span className="tabular-nums font-semibold">{left}</span>
    </span>
  );
}
