'use client';

// R13 Lane 2 (James-ruled): the dressed in-app DOCUMENTS room — the checklist
// doors for identity and insurance land here, and Lane 1's permanent DBS slot
// lives here too (optional, feeding the existing badge truthfully). L2 by
// construction: no website chrome exists on this route. Upload machinery is
// the existing POST /api/cleaners/documents, byte-untouched.

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type DocStatus = 'missing' | 'reviewing' | 'approved' | 'declined';

interface DocState {
  documents: Record<string, DocStatus>;
  rejected: { type: string; reason: string | null }[];
}

const SECTIONS: { key: string; title: string; sub: string; optional?: boolean }[] = [
  { key: 'photo_id', title: 'Photo ID', sub: 'Passport or driving licence' },
  { key: 'right_to_work', title: 'Right to work', sub: 'Your right to work document' },
  { key: 'insurance', title: 'Public liability insurance', sub: 'Your current certificate' },
  {
    key: 'dbs_certificate',
    title: 'DBS check',
    sub: 'Optional. Earn the DBS badge on your profile.',
    optional: true,
  },
];

function StatusChip({ status }: { status: DocStatus }) {
  if (status === 'approved') {
    return (
      <span className="rounded-full bg-success/15 px-2.5 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
        Approved
      </span>
    );
  }
  if (status === 'reviewing') {
    return (
      <span className="rounded-full bg-page px-2.5 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        Reviewing
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className="rounded-full bg-danger/10 px-2.5 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">
        Needs a new upload
      </span>
    );
  }
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
      Not uploaded
    </span>
  );
}

export default function DocumentsRoom() {
  const router = useRouter();
  const [state, setState] = useState<DocState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () =>
    fetch('/api/cleaner/dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.profile) return;
        setState({
          documents: d.profile.documents || {},
          rejected: d.profile.rejectedDocuments || [],
        });
      })
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const upload = async (key: string, file: File) => {
    setBusyKey(key);
    setError(null);
    try {
      const fileData: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/cleaners/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: key, fileData }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || 'Upload failed. Please try again.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div data-testid="documents-room">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface"
          data-testid="documents-back"
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Your documents
          </p>
          <h1 className="font-jost text-[22px] font-semibold leading-tight text-ink">
            Upload and track
          </h1>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-[10px] border border-danger/20 bg-danger/10 px-4 py-3 font-jost text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {SECTIONS.map((s) => {
          const status: DocStatus = state ? (state.documents[s.key] ?? 'missing') : 'missing';
          const reason = state?.rejected.find((r) => r.type === s.key)?.reason;
          const busy = busyKey === s.key;
          return (
            <div
              key={s.key}
              className={`rounded-2xl border bg-surface px-4 py-4 ${
                s.optional ? 'border-dashed border-line' : 'border-line'
              }`}
              data-testid={`doc-${s.key}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-jost text-[15px] font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 font-jost text-[12px] text-ink-3">{s.sub}</p>
                </div>
                {state ? <StatusChip status={status} /> : null}
              </div>
              {reason && status === 'declined' && (
                <p className="mt-2 font-jost text-[12px] text-danger">Not accepted: {reason}</p>
              )}
              <input
                ref={(el) => {
                  inputs.current[s.key] = el;
                }}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(s.key, f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputs.current[s.key]?.click()}
                className={`mt-3 rounded-[10px] px-4 py-2 font-jost text-[13px] font-semibold disabled:opacity-50 ${
                  status === 'missing' || status === 'declined'
                    ? 'bg-primary text-white'
                    : 'border border-line text-ink-2'
                }`}
                data-testid={`doc-${s.key}-upload`}
              >
                {busy ? 'Uploading…' : status === 'missing' ? 'Upload' : 'Replace'}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-5 font-jost text-[12px] text-ink-3">
        Our team reviews new uploads, usually within one working day. A replaced document goes back
        into review.
      </p>
    </div>
  );
}
