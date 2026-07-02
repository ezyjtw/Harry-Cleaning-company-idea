'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AgreementDoc {
  version: string;
  kind: string;
  title: string;
  effectiveDate: string;
  body: string;
}

interface Status {
  currentVersion: string;
  acknowledgedVersion: string | null;
  acknowledged: boolean;
}

export default function CleanerAgreementPage() {
  const router = useRouter();
  const [doc, setDoc] = useState<AgreementDoc | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/cleaner/agreement');
      if (res.ok) {
        const data = await res.json();
        setDoc(data.document);
        setStatus(data.status);
      }
    })();
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cleaner/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(data.status);
        setMsg('Thank you — your acknowledgment has been recorded.');
        setTimeout(() => router.push('/cleaner'), 1200);
      } else {
        setMsg(data.error || 'Could not record your acknowledgment.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!doc || !status) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-ink-3">Loading…</div>;
  }

  const needsReAck = !status.acknowledged && status.acknowledgedVersion !== null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-cormorant text-[24px] font-semibold text-ink">{doc.title}</h1>
      <p className="mt-1 font-jost text-[12px] text-ink-3">
        Version {doc.version} · effective {doc.effectiveDate}
      </p>

      {status.acknowledged && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 font-jost text-[13px] text-green-800">
          You&rsquo;ve acknowledged the current version. No action needed.
        </div>
      )}
      {needsReAck && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 font-jost text-[13px] text-amber-800">
          This acknowledgment has been updated since you last agreed. Please read and confirm the
          current version to keep taking jobs.
        </div>
      )}

      <div
        className="mt-5 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl bg-cream px-5 py-4 font-jost text-[14px] leading-relaxed text-ink"
        style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
      >
        {doc.body}
      </div>

      {msg && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 font-jost text-[13px] text-ink-2">
          {msg}
        </div>
      )}

      {!status.acknowledged && (
        <div className="mt-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span className="font-jost text-[14px] text-ink">
              I confirm I have read and understand this acknowledgment, and that I work with Rena as a
              self-employed cleaner.
            </span>
          </label>

          <button
            onClick={submit}
            disabled={!confirmed || busy}
            className="mt-4 rounded-full bg-ink px-6 py-2.5 font-jost text-[12px] uppercase tracking-[0.1em] text-cream transition hover:bg-ink/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Confirm & continue'}
          </button>
        </div>
      )}
    </div>
  );
}
