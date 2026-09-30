'use client';

import { useState } from 'react';

// R9 HQ — the manual paste-in notes slot on a competitor page.
export default function CompetitorNotes({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    setState('saving');
    try {
      const res = await fetch(`/api/admin/hq/competitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      });
      setState(res.ok ? 'saved' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="mt-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState('idle');
        }}
        rows={5}
        placeholder="Paste pricing screenshots' text, ad copy, anything worth keeping…"
        className="w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm font-light text-[#16296b] focus:border-[#16296b] focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={state === 'saving'}
          className="rounded-lg bg-[#16296b] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : 'Save notes'}
        </button>
        {state === 'saved' && <span className="text-xs font-light text-emerald-600">Saved.</span>}
        {state === 'error' && (
          <span className="text-xs font-light text-red-600">Save failed — try again.</span>
        )}
      </div>
    </div>
  );
}
