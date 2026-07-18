'use client';

import { useMemo, useState } from 'react';

import type { WaitlistRow } from './page';

const SOURCE_LABELS: Record<string, string> = {
  'quote-widget': 'Quote widget',
  'service-page': 'Service page',
  unknown: 'Unknown',
};

export default function AdminWaitlistClient({
  rows,
  total,
}: {
  rows: WaitlistRow[];
  total: number;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.postcode.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Waitlist</h1>
          <p className="text-ink-3 mt-1">
            {total} out-of-area {total === 1 ? 'signup' : 'signups'} — email them when cleaners
            reach their area
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search email or postcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <a
            href="/api/admin/waitlist/export"
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Export CSV
          </a>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-ink-3">
          {rows.length === 0 ? 'No waitlist entries yet.' : 'No entries match your search.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Postcode</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{r.email}</td>
                  <td className="px-4 py-3 font-medium text-ink">{r.postcode}</td>
                  <td className="px-4 py-3 text-ink-2">{r.date}</td>
                  <td className="px-4 py-3 text-ink-2">{SOURCE_LABELS[r.source] ?? r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
