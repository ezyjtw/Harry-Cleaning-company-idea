'use client';

import { useMemo, useState } from 'react';

// A13: cleaner self-serve earnings statements. Picks a UK tax year (default
// current) or a custom range and downloads a PDF from /api/cleaner/statement.
// The endpoint scopes to the authenticated cleaner — no id is sent from here.

function currentTaxYearStartYear(now: Date): number {
  const sixthApril = new Date(now.getFullYear(), 3, 6);
  return now < sixthApril ? now.getFullYear() - 1 : now.getFullYear();
}

function taxYearLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export default function CleanerStatements() {
  const currentStartYear = useMemo(() => currentTaxYearStartYear(new Date()), []);
  const taxYears = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentStartYear - i),
    [currentStartYear]
  );

  const [mode, setMode] = useState<'taxYear' | 'custom'>('taxYear');
  const [taxYear, setTaxYear] = useState<number>(currentStartYear);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const href =
    mode === 'taxYear'
      ? `/api/cleaner/statement?taxYear=${taxYear}`
      : `/api/cleaner/statement?from=${from}&to=${to}`;

  const customIncomplete = mode === 'custom' && (!from || !to);
  const rangeInvalid = mode === 'custom' && !!from && !!to && from > to;
  const disabled = customIncomplete || rangeInvalid;

  const inputCls =
    'px-3 py-2 font-jost text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink/20';
  const fieldStyle = { border: '0.5px solid rgba(14,14,12,0.1)' } as const;

  return (
    <div className="mt-8 bg-white p-6" style={fieldStyle}>
      <h2 className="font-cormorant text-xl font-light text-ink">Statements</h2>
      <p className="mt-1 font-jost text-sm font-light text-ink-3">
        Download a PDF summary of your earnings for your records or Self Assessment. Covers jobs
        whose funds were released to you in the period.
      </p>

      {/* Mode toggle */}
      <div className="mt-4 flex gap-1 bg-cream-2 p-1 w-fit" style={fieldStyle}>
        {(['taxYear', 'custom'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 font-jost text-xs transition-colors ${
              mode === m ? 'bg-ink text-cream' : 'text-ink-3 hover:text-ink'
            }`}
          >
            {m === 'taxYear' ? 'Tax year' : 'Custom range'}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        {mode === 'taxYear' ? (
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Tax year
            </label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className={`mt-1 ${inputCls}`}
              style={fieldStyle}
            >
              {taxYears.map((y) => (
                <option key={y} value={y}>
                  {taxYearLabel(y)} (6 Apr {y} – 5 Apr {y + 1})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={`mt-1 ${inputCls}`}
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={`mt-1 ${inputCls}`}
                style={fieldStyle}
              />
            </div>
          </>
        )}

        {disabled ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed bg-ink/30 px-5 py-2 font-jost text-xs uppercase tracking-[0.1em] text-cream"
          >
            Download statement (PDF)
          </button>
        ) : (
          <a
            href={href}
            className="bg-ink px-5 py-2 text-center font-jost text-xs uppercase tracking-[0.1em] text-cream transition hover:bg-gold"
          >
            Download statement (PDF)
          </a>
        )}
      </div>

      {rangeInvalid && (
        <p className="mt-2 font-jost text-xs font-light text-red-600">
          The start date must be on or before the end date.
        </p>
      )}
    </div>
  );
}
