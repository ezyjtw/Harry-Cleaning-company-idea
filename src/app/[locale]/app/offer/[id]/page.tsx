'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface Offer {
  id: string;
  status: string;
  cascadePhase: string | null;
  cascadeExpiresAt: string | null;
  clientName: string;
  address: string;
  postcode: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  cleanerEarnings: number;
  notes: string | null;
  bedrooms?: number;
}

function serviceLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function windowLabel(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m left to respond`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s left to respond`;
}

export default function OfferPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [processing, setProcessing] = useState<'accept' | 'decline' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchOffer = useCallback(async () => {
    try {
      const res = await fetch(`/api/cleaner/jobs/${params.id}`);
      if (res.status === 404) {
        setGone(true);
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.job) setOffer(data.job);
      else setGone(true);
    } catch {
      setResult({ ok: false, text: "Couldn't load this offer. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const respond = async (action: 'accept' | 'decline') => {
    if (!offer) return;
    setProcessing(action);
    setResult(null);
    // RENA_FIND offers accept via a dedicated endpoint; every other offer phase
    // uses the standard cascade accept. Decline is shared.
    const endpoint =
      action === 'decline'
        ? `/api/cleaner/jobs/${offer.id}/decline`
        : offer.cascadePhase === 'RENA_FIND'
          ? `/api/cleaner/jobs/${offer.id}/rena-find-accept`
          : `/api/cleaner/jobs/${offer.id}/accept`;
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success !== false) {
        if (action === 'accept') {
          setResult({ ok: true, text: 'Job accepted — added to Today.' });
          setTimeout(() => router.push('/app/today'), 900);
        } else {
          setResult({ ok: true, text: 'Offer declined.' });
          setTimeout(() => router.push('/app/today'), 900);
        }
      } else {
        setResult({
          ok: false,
          text: data?.reason || data?.error || 'This offer is no longer available.',
        });
      }
    } catch {
      setResult({ ok: false, text: 'Network error — please try again.' });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-line" />;
  }

  if (gone) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-newsreader text-xl font-semibold text-ink">Offer no longer available</h1>
        <p className="mt-2 font-jost text-sm text-ink-2">
          This job has been taken or the offer window has closed.
        </p>
        <button
          type="button"
          onClick={() => router.push('/app/today')}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Back to Today
        </button>
      </div>
    );
  }

  if (!offer) return null;

  const wl = windowLabel(offer.cascadeExpiresAt, now);
  const expired = wl === 'Expired';

  return (
    <div>
      {wl && (
        <div
          className={`mb-4 rounded-xl px-4 py-2.5 text-center font-jost text-sm font-semibold ${
            expired ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
          }`}
        >
          {wl}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          New job offer
        </p>
        <h1 className="mt-1 font-newsreader text-2xl font-semibold text-ink">
          {serviceLabel(offer.serviceType)}
        </h1>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-jost text-sm text-ink-3">You&apos;ll earn</span>
          <span className="font-newsreader text-3xl font-medium text-ink">
            £{offer.cleanerEarnings.toFixed(2)}
          </span>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4 font-jost text-sm">
          <Row label="When" value={`${new Date(`${offer.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${offer.time}`} />
          <Row label="Duration" value={`${offer.duration} hours`} />
          <Row label="Area" value={offer.postcode || offer.address} />
          {typeof offer.bedrooms === 'number' && <Row label="Property" value={`${offer.bedrooms} bed`} />}
          <Row label="Customer" value={offer.clientName} />
        </div>

        {offer.notes && (
          <div className="mt-4 rounded-lg bg-page p-3">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
              Notes
            </p>
            <p className="mt-1 font-jost text-sm text-ink-2">{offer.notes}</p>
          </div>
        )}
      </div>

      {result && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 font-jost text-sm ${
            result.ok ? 'bg-trust/10 text-trust' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.text}
        </div>
      )}

      {!result?.ok && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => respond('decline')}
            disabled={!!processing || expired}
            className="rounded-[12px] border border-line bg-surface px-4 py-3 font-jost text-base font-medium text-ink-2 transition-colors hover:bg-page disabled:opacity-50"
          >
            {processing === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            type="button"
            onClick={() => respond('accept')}
            disabled={!!processing || expired}
            className="rounded-[12px] bg-primary px-4 py-3 font-jost text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {processing === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-3">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
