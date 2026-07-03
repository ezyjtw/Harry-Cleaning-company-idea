'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FunnelStep {
  step: number | null;
  stepName: string | null;
  uniqueSessions: number;
  dropOffRate: number;
  overallConversionRate: number;
}

interface DropOff {
  step: number | null;
  stepName: string | null;
  dropOffCount: number;
  avgTimeOnStep: number | null;
}

interface FormError {
  field: string;
  errorCount: number;
  topErrors: { message: string; count: number }[];
}

interface StepTiming {
  step: number | null;
  stepName: string | null;
  avgDuration: number | null;
  maxDuration: number | null;
  minDuration: number | null;
  sampleSize: number;
}

type FunnelType = 'booking' | 'cleaner_signup' | 'client_signup';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FunnelAnalyticsPage() {
  const [funnel, setFunnel] = useState<FunnelType>('booking');
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [dropOffData, setDropOffData] = useState<DropOff[]>([]);
  const [errorData, setErrorData] = useState<FormError[]>([]);
  const [timingData, setTimingData] = useState<StepTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ funnel });
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);

    try {
      const [funnelRes, dropOffRes, errorRes, timingRes] = await Promise.all([
        fetch(`/api/analytics/funnel?${params}&view=funnel`),
        fetch(`/api/analytics/funnel?${params}&view=dropoffs`),
        fetch(`/api/analytics/funnel?${params}&view=errors`),
        fetch(`/api/analytics/funnel?${params}&view=timing`),
      ]);

      const [funnelJson, dropOffJson, errorJson, timingJson] = await Promise.all([
        funnelRes.json(),
        dropOffRes.json(),
        errorRes.json(),
        timingRes.json(),
      ]);

      setFunnelData(funnelJson.data ?? []);
      setDropOffData(dropOffJson.data ?? []);
      setErrorData(errorJson.data ?? []);
      setTimingData(timingJson.data ?? []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, [funnel, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxSessions = funnelData.length > 0 ? funnelData[0].uniqueSessions : 1;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-ink/5 bg-white/50 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <Link href="/admin" className="font-jost text-sm text-ink-3 hover:text-ink">
              &larr; Admin Dashboard
            </Link>
            <h1 className="mt-1 font-newsreader text-2xl font-semibold text-ink">Funnel Analytics</h1>
            <p className="font-jost text-sm font-light text-ink-3">
              Track where customers drop off and identify friction points
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Controls */}
        <div className="mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block font-jost text-xs uppercase tracking-wider text-ink-3">
              Funnel
            </label>
            <select
              value={funnel}
              onChange={(e) => setFunnel(e.target.value as FunnelType)}
              className="border border-ink/10 bg-white px-4 py-2 font-jost text-sm text-ink"
            >
              <option value="booking">Booking Flow</option>
              <option value="cleaner_signup">Cleaner Signup</option>
              <option value="client_signup">Client Signup</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-jost text-xs uppercase tracking-wider text-ink-3">
              From
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="border border-ink/10 bg-white px-4 py-2 font-jost text-sm text-ink"
            />
          </div>
          <div>
            <label className="mb-1 block font-jost text-xs uppercase tracking-wider text-ink-3">
              To
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="border border-ink/10 bg-white px-4 py-2 font-jost text-sm text-ink"
            />
          </div>
          <button
            onClick={fetchData}
            className="bg-ink px-6 py-2 font-jost text-sm text-cream hover:bg-ink/90"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center font-jost text-ink-3">Loading analytics...</div>
        ) : (
          <div className="space-y-8">
            {/* ─── Funnel Visualisation ─── */}
            <section>
              <h2 className="mb-4 font-newsreader text-xl font-semibold text-ink">Conversion Funnel</h2>
              {funnelData.length === 0 ? (
                <p className="py-8 text-center font-jost text-sm text-ink-3">
                  No funnel data yet. Events will appear here as users interact with the{' '}
                  {funnel.replace('_', ' ')} flow.
                </p>
              ) : (
                <div className="space-y-2">
                  {funnelData.map((step, i) => (
                    <div key={step.step} className="flex items-center gap-4">
                      <div className="w-40 text-right font-jost text-sm text-ink-2">
                        <span className="font-normal text-ink">{step.stepName}</span>
                      </div>
                      <div className="flex-1">
                        <div className="relative h-10 bg-cream-2">
                          <div
                            className="absolute inset-y-0 left-0 bg-gold/30"
                            style={{
                              width: `${maxSessions > 0 ? (step.uniqueSessions / maxSessions) * 100 : 0}%`,
                            }}
                          />
                          <div className="absolute inset-y-0 flex items-center px-3">
                            <span className="font-jost text-sm font-normal text-ink">
                              {step.uniqueSessions.toLocaleString()} sessions
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right font-jost text-sm">
                        <span className="text-ink">{step.overallConversionRate}%</span>
                      </div>
                      <div className="w-24 text-right font-jost text-sm">
                        {i > 0 && step.dropOffRate > 0 ? (
                          <span className={step.dropOffRate > 30 ? 'text-red-600' : 'text-ink-3'}>
                            -{step.dropOffRate}%
                          </span>
                        ) : (
                          <span className="text-ink-3">&mdash;</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ─── Drop-Off Analysis ─── */}
            <section>
              <h2 className="mb-4 font-newsreader text-xl font-semibold text-ink">Drop-Off Hotspots</h2>
              {dropOffData.length === 0 ? (
                <p className="py-8 text-center font-jost text-sm text-ink-3">
                  No drop-off events recorded yet.
                </p>
              ) : (
                <div className="overflow-hidden border border-ink/5">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink/5 bg-cream-2">
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Step
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Drop-offs
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Avg Time on Step
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Severity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dropOffData.map((d) => (
                        <tr key={d.step} className="border-b border-ink/5">
                          <td className="px-4 py-3 font-jost text-sm text-ink">
                            Step {d.step}: {d.stepName}
                          </td>
                          <td className="px-4 py-3 font-jost text-sm font-normal text-ink">
                            {d.dropOffCount}
                          </td>
                          <td className="px-4 py-3 font-jost text-sm text-ink-2">
                            {d.avgTimeOnStep ? `${d.avgTimeOnStep}s` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 font-jost text-xs ${
                                d.dropOffCount > 50
                                  ? 'bg-red-100 text-red-700'
                                  : d.dropOffCount > 20
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {d.dropOffCount > 50
                                ? 'Critical'
                                : d.dropOffCount > 20
                                  ? 'Warning'
                                  : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ─── Form Errors ─── */}
            <section>
              <h2 className="mb-4 font-newsreader text-xl font-semibold text-ink">
                Form Friction Points
              </h2>
              <p className="mb-3 font-jost text-sm text-ink-3">
                Fields causing the most validation errors — likely frustrating users
              </p>
              {errorData.length === 0 ? (
                <p className="py-8 text-center font-jost text-sm text-ink-3">
                  No form errors recorded yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {errorData.map((err) => (
                    <div key={err.field} className="border border-ink/5 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-jost text-sm font-normal text-ink">{err.field}</h3>
                        <span className="font-jost text-lg font-light text-red-600">
                          {err.errorCount}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {err.topErrors.map((e) => (
                          <div
                            key={e.message}
                            className="flex justify-between font-jost text-xs text-ink-3"
                          >
                            <span className="truncate">{e.message}</span>
                            <span className="ml-2 shrink-0">{e.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ─── Step Timing ─── */}
            <section>
              <h2 className="mb-4 font-newsreader text-xl font-semibold text-ink">Time per Step</h2>
              <p className="mb-3 font-jost text-sm text-ink-3">
                High average times may indicate confusion or too many required fields
              </p>
              {timingData.length === 0 ? (
                <p className="py-8 text-center font-jost text-sm text-ink-3">
                  No timing data recorded yet.
                </p>
              ) : (
                <div className="overflow-hidden border border-ink/5">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink/5 bg-cream-2">
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Step
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Avg Time
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Min
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Max
                        </th>
                        <th className="px-4 py-3 text-left font-jost text-xs uppercase tracking-wider text-ink-3">
                          Samples
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {timingData.map((t) => (
                        <tr key={t.step} className="border-b border-ink/5">
                          <td className="px-4 py-3 font-jost text-sm text-ink">{t.stepName}</td>
                          <td className="px-4 py-3 font-jost text-sm font-normal text-ink">
                            {t.avgDuration ? `${t.avgDuration}s` : '—'}
                          </td>
                          <td className="px-4 py-3 font-jost text-sm text-ink-2">
                            {t.minDuration ? `${t.minDuration}s` : '—'}
                          </td>
                          <td className="px-4 py-3 font-jost text-sm text-ink-2">
                            {t.maxDuration ? `${t.maxDuration}s` : '—'}
                          </td>
                          <td className="px-4 py-3 font-jost text-sm text-ink-3">{t.sampleSize}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
