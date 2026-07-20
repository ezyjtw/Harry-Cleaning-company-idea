'use client';

// Admin dispute detail (client): renders the full case and wires the resolution
// actions to the EXISTING money-aware machinery
// (POST /api/admin/bookings/[bookingId]/dispute → AdminOperationsService,
// with its transfer/refund guards). The old admin disputes page only stamped
// status; this moves real money.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import NavLink from '@/components/nav/NavLink';

type Party = 'customer' | 'cleaner' | 'Rena team';

interface DisputeData {
  id: string;
  shortId: string;
  status: string;
  reason: string;
  description: string;
  resolution: string | null;
  createdAt: string;
  filedBy: string;
  booking: {
    id: string;
    shortId: string;
    status: string;
    transferStatus: string;
    paymentStatus: string;
    serviceType: string;
    date: string;
    time: string;
    charged: number;
    cleanerEarnings: number;
    refundedSoFar: number;
    remainder: number;
    customer: { name: string; email: string };
    cleaner: { name: string; email: string };
  };
  evidence: {
    id: string;
    type: string;
    fileName: string | null;
    description: string | null;
    uploadedBy: Party;
    uploadedAt: string;
    viewUrl: string;
  }[];
  messages: { id: string; party: Party; content: string; at: string }[];
  timeline: { id: string; label: string; at: string }[];
}

const RESOLVED = ['RESOLVED', 'DISMISSED'];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DisputeDetail({ data }: { data: DisputeData }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<'release-to-cleaner' | 'refund-customer' | 'split' | ''>(
    ''
  );
  const [refundAmount, setRefundAmount] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alreadyResolved = RESOLVED.includes(data.status);

  const submit = async () => {
    setError(null);
    setMessage(null);
    if (!outcome) return setError('Choose an outcome.');
    if (!resolution.trim()) return setError('A resolution note is required (it is audited).');
    if (outcome === 'split') {
      const amt = Number(refundAmount);
      if (!amt || amt <= 0) return setError('Split needs a positive refund amount.');
      if (amt > data.booking.remainder)
        return setError(`Refund can't exceed the remaining £${data.booking.remainder.toFixed(2)}.`);
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bookings/${data.booking.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          resolution: resolution.trim(),
          ...(outcome === 'split' ? { refundAmount: Number(refundAmount) } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setMessage(
          `Resolved: ${body?.outcome ?? outcome}. Refunded £${(body?.refundedAmount ?? 0).toFixed?.(2) ?? body?.refundedAmount ?? 0}.`
        );
        router.refresh();
      } else {
        setError(body?.error || 'Resolution failed.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const partyChip = (p: Party) =>
    p === 'customer'
      ? 'bg-primary-soft text-primary'
      : p === 'cleaner'
        ? 'bg-trust/10 text-trust'
        : 'bg-page text-ink-3';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* P5 (ledger): H39 resilient-nav wrap — this back-link was the one nav
          surface left on a bare Link. */}
      <NavLink
        surface="admin-dispute-detail"
        href="/admin/disputes"
        className="text-sm text-ink-3 hover:text-ink"
      >
        ← All disputes
      </NavLink>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Dispute #{data.shortId}</h1>
        <span className="rounded-full bg-page px-3 py-0.5 text-xs font-medium text-ink-2">
          {data.status.replace(/_/g, ' ').toLowerCase()}
        </span>
        <span className="text-sm text-ink-3">
          Filed by {data.filedBy} · {fmt(data.createdAt)}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: claim, evidence, thread, timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Claim */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">The claim</h2>
            <p className="mt-2 text-sm font-medium text-ink-2">
              Reason: <span className="font-normal">{data.reason}</span>
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{data.description}</p>
          </section>

          {/* Evidence — both parties, view + download */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">
              Evidence ({data.evidence.length})
            </h2>
            {data.evidence.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">No evidence submitted.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-page px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${partyChip(ev.uploadedBy)}`}
                      >
                        {ev.uploadedBy}
                      </span>
                      <span className="truncate text-sm text-ink-2">
                        {ev.fileName || ev.description || ev.type.toLowerCase()}
                      </span>
                      <span className="shrink-0 text-xs text-ink-3">{fmt(ev.uploadedAt)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <a
                        href={ev.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </a>
                      <a
                        href={`${ev.viewUrl}?download=1`}
                        className="text-xs font-medium text-ink-2 hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Message thread */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">
              Messages between the parties
            </h2>
            {data.messages.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">No messages on this booking.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.messages.map((m) => (
                  <div key={m.id} className="rounded-lg bg-page px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${partyChip(m.party)}`}
                      >
                        {m.party}
                      </span>
                      <span className="text-xs text-ink-3">{fmt(m.at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">Timeline</h2>
            <ol className="mt-3 space-y-2">
              {data.timeline.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-32 shrink-0 text-xs text-ink-3">{fmt(t.at)}</span>
                  <span className="text-ink-2">{t.label}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right: booking + money context, resolution actions */}
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">Booking</h2>
            <Link
              href={`/admin/bookings/${data.booking.id}`}
              className="mt-1 block text-sm text-primary hover:underline"
            >
              #{data.booking.shortId} →
            </Link>
            <dl className="mt-3 space-y-1.5 text-sm">
              {[
                ['Service', data.booking.serviceType],
                ['When', `${data.booking.date} · ${data.booking.time}`],
                ['Customer', data.booking.customer.name],
                ['Cleaner', data.booking.cleaner.name],
                ['Booking status', data.booking.status],
                ['Payment', data.booking.paymentStatus],
                ['Transfer', data.booking.transferStatus],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              {[
                ['Charged', data.booking.charged],
                ['Cleaner earnings', data.booking.cleanerEarnings],
                ['Refunded so far', data.booking.refundedSoFar],
                ['Remaining', data.booking.remainder],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">£{(v as number).toFixed(2)}</dd>
                </div>
              ))}
            </div>
          </section>

          {/* Resolution — real money machinery with guards */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-newsreader text-lg font-semibold text-ink">Resolve</h2>
            {alreadyResolved ? (
              <div className="mt-2 rounded-lg bg-trust/10 px-3 py-2 text-sm text-trust">
                Already resolved{data.resolution ? `: ${data.resolution}` : ''}.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {(
                  [
                    ['release-to-cleaner', 'Release to cleaner', 'Full pay to cleaner, no refund'],
                    ['refund-customer', 'Refund customer', 'Full refund, no pay'],
                    ['split', 'Split', 'Partial refund, release remainder'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="outcome"
                      value={value}
                      checked={outcome === value}
                      onChange={() => setOutcome(value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{label}</span>
                      <span className="block text-xs text-ink-3">{hint}</span>
                    </span>
                  </label>
                ))}
                {outcome === 'split' && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={data.booking.remainder}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Refund £ (max ${data.booking.remainder.toFixed(2)})`}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                )}
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Resolution note (required — audited)"
                  rows={3}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
                {error && <p className="text-sm text-danger">{error}</p>}
                {message && <p className="text-sm text-trust">{message}</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? 'Resolving…' : 'Resolve dispute'}
                </button>
                <p className="text-[11px] text-ink-3">
                  Money guards apply: a resolution is refused if funds are mid-release or already
                  released (handled server-side).
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
