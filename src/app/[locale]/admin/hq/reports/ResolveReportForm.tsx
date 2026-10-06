'use client';

// Resolve-with-reason, the HQ grammar: a written reason is required before any
// report leaves the open queue. Review and conversation reports resolve
// through /api/admin/reports/[id]; per-message reports keep their existing
// actioned / dismissed verbs through /api/admin/message-reports/[id], with the
// same required note.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResolveReportForm({
  kind,
  id,
}: {
  kind: 'content' | 'message';
  id: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action?: 'ACTION' | 'DISMISS') {
    const reason = note.trim();
    if (reason.length < 3) {
      setError('Write the reason first.');
      return;
    }
    setBusy(action ?? 'RESOLVE');
    setError(null);
    try {
      const res =
        kind === 'content'
          ? await fetch(`/api/admin/reports/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resolution: reason }),
            })
          : await fetch(`/api/admin/message-reports/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, adminNotes: reason }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'That did not save.');
        return;
      }
      router.refresh();
    } catch {
      setError('That did not save. Check the connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  const btn =
    'rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50';

  return (
    <div className="mt-4 border-t border-[#F1F4F8] pt-4" data-testid={`hq-resolve-${id}`}>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
        Resolve with reason
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="What you decided and why (required)"
        className="mt-1 w-full rounded-xl border border-[#E4E9F0] px-3 py-2 text-sm font-light text-[#16296b] placeholder-[#8A97AB]"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        {kind === 'content' ? (
          <button
            type="button"
            onClick={() => resolve()}
            disabled={!!busy}
            className={`${btn} bg-[#16296b] text-white`}
          >
            {busy ? 'Saving…' : 'Resolve'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => resolve('ACTION')}
              disabled={!!busy}
              className={`${btn} bg-[#16296b] text-white`}
            >
              {busy === 'ACTION' ? 'Saving…' : 'Actioned'}
            </button>
            <button
              type="button"
              onClick={() => resolve('DISMISS')}
              disabled={!!busy}
              className={`${btn} border border-[#E4E9F0] text-[#3D5170]`}
            >
              {busy === 'DISMISS' ? 'Saving…' : 'Dismissed'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
