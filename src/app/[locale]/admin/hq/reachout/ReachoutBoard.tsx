'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { PROSPECT_STATUSES, type ProspectStatus } from '@/lib/hq/prospects';

// R9 HQ — the Reachout pipeline board (client). Five status columns, add/edit
// in a side panel, notes history, next-action overdue highlighting.

interface Note {
  id: string;
  body: string;
  createdAt: string;
}

interface Prospect {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  area: string | null;
  source: string;
  status: string;
  userId: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: Note[];
}

const STATUS_LABELS: Record<ProspectStatus, string> = {
  found: 'Found',
  contacted: 'Contacted',
  replied: 'Replied',
  stalled: 'Stalled',
  joined: 'Joined',
};

function isOverdue(p: Prospect): boolean {
  return !!p.nextActionAt && p.status !== 'joined' && new Date(p.nextActionAt) < new Date();
}

export default function ReachoutBoard() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/hq/prospects');
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setProspects(d.prospects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function applyUpdated(p: Prospect) {
    setProspects((cur) => (cur ? cur.map((x) => (x.id === p.id ? p : x)) : cur));
  }

  async function patchProspect(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/hq/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) applyUpdated((await res.json()).prospect);
    } finally {
      setBusy(false);
    }
  }

  async function addNote(id: string, note: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/hq/prospects/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (res.ok) applyUpdated((await res.json()).prospect);
    } finally {
      setBusy(false);
    }
  }

  async function createProspect(fields: Record<string, unknown>): Promise<string | null> {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/hq/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const d = await res.json();
      if (!res.ok) return d.error ?? 'Could not create.';
      setProspects((cur) => (cur ? [d.prospect, ...cur] : [d.prospect]));
      setAdding(false);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-[#E4E9F0] bg-white p-5 text-sm font-light text-red-600">
        Pipeline failed to load ({error}). Refresh to retry.
      </p>
    );
  }
  if (!prospects) {
    return <p className="text-sm font-light text-[#8A97AB]">Loading pipeline…</p>;
  }

  const open = openId ? (prospects.find((p) => p.id === openId) ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-light text-[#3D5170]">
          {prospects.length} prospect{prospects.length === 1 ? '' : 's'} ·{' '}
          {prospects.filter(isOverdue).length} overdue
        </p>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-[#16296b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white"
        >
          Add prospect
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PROSPECT_STATUSES.map((status) => {
          const col = prospects.filter((p) => p.status === status);
          return (
            <div key={status} className="rounded-2xl border border-[#E4E9F0] bg-white p-3">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
                {STATUS_LABELS[status]} · {col.length}
              </p>
              <div className="mt-2 space-y-2">
                {col.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    className={`block w-full rounded-xl border p-2.5 text-left transition-colors hover:border-[#16296b]/40 ${
                      isOverdue(p) ? 'border-red-300 bg-red-50' : 'border-[#EEF2F7] bg-[#FAFBFC]'
                    }`}
                  >
                    <p className="text-sm font-medium text-[#16296b]">{p.name}</p>
                    <p className="mt-0.5 text-[11px] font-light text-[#3D5170]">
                      {p.area ?? '—'}
                      {p.notes.length > 0 &&
                        ` · ${p.notes.length} note${p.notes.length === 1 ? '' : 's'}`}
                    </p>
                    {p.nextActionAt && (
                      <p
                        className={`mt-0.5 text-[11px] ${
                          isOverdue(p) ? 'font-semibold text-red-600' : 'font-light text-[#8A97AB]'
                        }`}
                      >
                        next: {new Date(p.nextActionAt).toLocaleDateString('en-GB')}
                        {isOverdue(p) && ' — overdue'}
                      </p>
                    )}
                  </button>
                ))}
                {col.length === 0 && (
                  <p className="px-1 py-2 text-[11px] font-light text-[#C6CFDB]">empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddPanel busy={busy} onClose={() => setAdding(false)} onCreate={createProspect} />
      )}
      {open && (
        <DetailPanel
          prospect={open}
          busy={busy}
          onClose={() => setOpenId(null)}
          onPatch={patchProspect}
          onNote={addNote}
        />
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#16296b]/30 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E4E9F0] bg-white p-5 shadow-xl">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-[#8A97AB] hover:text-[#16296b]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm font-light text-[#16296b] focus:border-[#16296b] focus:outline-none';

function AddPanel({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (fields: Record<string, unknown>) => Promise<string | null>;
}) {
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    area: '',
    status: 'found',
    nextActionAt: '',
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Overlay onClose={onClose}>
      <p className="text-sm font-semibold text-[#16296b]">New prospect</p>
      <div className="mt-3 space-y-2.5">
        <input
          className={inputCls}
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Email (optional)"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Phone (optional)"
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Area (optional)"
          value={f.area}
          onChange={(e) => setF({ ...f, area: e.target.value })}
        />
        <select
          className={inputCls}
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value })}
        >
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="block text-[11px] font-light text-[#8A97AB]">
          Next action date
          <input
            type="date"
            className={`${inputCls} mt-1`}
            value={f.nextActionAt}
            onChange={(e) => setF({ ...f, nextActionAt: e.target.value })}
          />
        </label>
        {err && <p className="text-xs font-light text-red-600">{err}</p>}
        <button
          disabled={busy || !f.name.trim()}
          onClick={async () => setErr(await onCreate(f))}
          className="w-full rounded-lg bg-[#16296b] py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
        >
          Add to pipeline
        </button>
      </div>
    </Overlay>
  );
}

function DetailPanel({
  prospect,
  busy,
  onClose,
  onPatch,
  onNote,
}: {
  prospect: Prospect;
  busy: boolean;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onNote: (id: string, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [next, setNext] = useState(prospect.nextActionAt ? prospect.nextActionAt.slice(0, 10) : '');

  return (
    <Overlay onClose={onClose}>
      <p className="text-base font-semibold text-[#16296b]">{prospect.name}</p>
      <p className="mt-0.5 text-xs font-light text-[#3D5170]">
        {prospect.email ?? 'no email'} · {prospect.phone ?? 'no phone'} ·{' '}
        {prospect.area ?? 'no area'}
        <span className="ml-1 text-[#8A97AB]">({prospect.source})</span>
      </p>
      {prospect.userId && (
        <Link
          href={`/admin/cleaners/${prospect.userId}`}
          className="mt-1 inline-block text-xs font-semibold text-[#16296b] underline"
        >
          Open her dossier →
        </Link>
      )}

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
          Status
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PROSPECT_STATUSES.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => void onPatch(prospect.id, { status: s })}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                prospect.status === s
                  ? 'bg-[#16296b] text-white'
                  : 'border border-[#E4E9F0] text-[#3D5170] hover:border-[#16296b]/40'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
          Next action
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            type="date"
            className={inputCls}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={() => void onPatch(prospect.id, { nextActionAt: next || null })}
            className="shrink-0 rounded-lg border border-[#16296b] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#16296b]"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
          Notes ({prospect.notes.length})
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            className={inputCls}
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            disabled={busy || !note.trim()}
            onClick={async () => {
              await onNote(prospect.id, note.trim());
              setNote('');
            }}
            className="shrink-0 rounded-lg bg-[#16296b] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {prospect.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-[#FAFBFC] p-2.5">
              <p className="text-sm font-light text-[#3D5170]">{n.body}</p>
              <p className="mt-1 text-[10px] font-light text-[#8A97AB]">
                {new Date(n.createdAt).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
          {prospect.notes.length === 0 && (
            <li className="text-xs font-light text-[#C6CFDB]">No notes yet.</li>
          )}
        </ul>
      </div>
    </Overlay>
  );
}
