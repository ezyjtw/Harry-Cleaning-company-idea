// R9 RENA HQ — the shared dress kit. Server-renderable (no client JS): the
// approved grammar — Jost, navy #16296B, flat white hairline cards on the
// #FAFBFC page ground, letterspaced uppercase labels, back chevron per the
// standing grammar. Every room composes from these so the seven rooms cannot
// drift apart in dress.

import Link from 'next/link';

export const HQ_NAVY = '#16296b';

/** Room page shell: back chevron to the command screen + title + content. */
export function RoomShell({
  title,
  subtitle,
  backHref = '/admin/hq',
  backLabel = 'HQ',
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFBFC] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#3D5170] hover:text-[#16296b]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {backLabel}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-[#16296b]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-light text-[#3D5170]">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/** The flat white hairline card. */
export function HqCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#E4E9F0] bg-white ${className}`}>{children}</div>
  );
}

export function HqLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
      {children}
    </p>
  );
}

/** Amber/green/grey status dot. */
export function StatusDot({ tone }: { tone: 'ok' | 'amber' | 'red' | 'idle' }) {
  const color =
    tone === 'ok'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'red'
          ? 'bg-red-500'
          : 'bg-[#C6CFDB]';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}

/**
 * Tiny inline bar series (pure SVG, server-renderable — no chart library).
 * Values render left→right; a zero row still shows a hairline baseline.
 */
export function MiniBars({
  values,
  height = 48,
  barColor = HQ_NAVY,
  labels,
}: {
  values: number[];
  height?: number;
  barColor?: string;
  labels?: { first?: string; last?: string };
}) {
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length);
  const w = 100 / n;
  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label="bar series"
      >
        <line
          x1="0"
          y1={height - 0.5}
          x2="100"
          y2={height - 0.5}
          stroke="#E4E9F0"
          strokeWidth="1"
        />
        {values.map((v, i) => {
          const h = v <= 0 ? 0 : Math.max(1.5, (v / max) * (height - 4));
          return (
            <rect
              key={i}
              x={i * w + w * 0.15}
              y={height - h}
              width={w * 0.7}
              height={h}
              rx={0.6}
              fill={barColor}
              opacity={0.9}
            />
          );
        })}
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] font-light text-[#8A97AB]">
          <span>{labels.first}</span>
          <span>{labels.last}</span>
        </div>
      )}
    </div>
  );
}

/** Limit-vs-usage meter with the amber threshold marked. */
export function UsageMeter({
  used,
  limit,
  amberPct,
}: {
  used: number;
  limit: number;
  amberPct: number;
}) {
  const pct = Math.min(100, (used / Math.max(1, limit)) * 100);
  const amber = pct >= amberPct;
  return (
    <div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#EEF2F7]">
        <div
          className={`h-full rounded-full ${amber ? 'bg-amber-500' : 'bg-[#16296b]'}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-amber-400"
          style={{ left: `${amberPct}%` }}
          title={`amber at ${amberPct}%`}
        />
      </div>
      <p className="mt-1 text-[11px] font-light text-[#3D5170]">
        {used.toLocaleString()} of {limit.toLocaleString()} ({pct.toFixed(0)}%)
        {amber && <span className="ml-1 font-semibold text-amber-600">amber</span>}
      </p>
    </div>
  );
}

/** Command-screen door card: glance on the face, the room behind the tap. */
export function DoorCard({
  href,
  title,
  glance,
  children,
}: {
  href: string;
  title: string;
  glance?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-[#E4E9F0] bg-white p-5 transition-colors hover:border-[#16296b]/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16296b]">{title}</p>
        <svg
          className="h-4 w-4 text-[#C6CFDB] transition-colors group-hover:text-[#16296b]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      {glance && <div className="mt-3 text-2xl font-semibold text-[#16296b]">{glance}</div>}
      {children && <div className="mt-2 text-sm font-light text-[#3D5170]">{children}</div>}
    </Link>
  );
}
