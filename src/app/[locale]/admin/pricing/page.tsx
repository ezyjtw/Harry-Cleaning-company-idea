'use client';

import Decimal from 'decimal.js';
import { useCallback, useEffect, useState } from 'react';

import {
  COMMISSION_RATES,
  EDITABLE_PLATFORM_CONFIG_KEYS,
  PLATFORM_FEE_RATE,
  PRODUCTS_FEE,
  PRODUCTS_FEE_COMMISSION_RATE,
} from '@/lib/pricing/rates';

const EDITABLE = new Set<string>(EDITABLE_PLATFORM_CONFIG_KEYS);
const pct = (n: number) => `${Math.round(n * 100)}%`;

interface PlatformConfigEntry {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export default function AdminPricingPage() {
  const [configs, setConfigs] = useState<PlatformConfigEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const configRes = await fetch('/api/admin/pricing/config');
      if (configRes.ok) setConfigs(await configRes.json());
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/admin/pricing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSaveStatus(`Saved ${key}`);
        setEditingKey(null);
        fetchData();
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus(
          `Not saved: ${key} (${res.status === 400 ? 'not editable or not a number' : `HTTP ${res.status}`})`
        );
      }
    } catch {
      setSaveStatus('Failed to save');
    }
  };

  // Margin calculator (B4, RENA-075): the real rates from code, never the
  // database keys that once pretended to control them.
  const cleanerFeePct = COMMISSION_RATES.regular;
  const customerFeePct = PLATFORM_FEE_RATE;

  const calcMargin = (rate: number, hours: number) => {
    const gross = new Decimal(rate).mul(hours);
    const cleanerFee = gross.mul(cleanerFeePct);
    const customerFee = gross.mul(customerFeePct);
    const renaTotal = cleanerFee.plus(customerFee);
    return {
      gross: gross.toDecimalPlaces(2).toNumber(),
      renaEarns: renaTotal.toDecimalPlaces(2).toNumber(),
      marginPct: gross.gt(0) ? renaTotal.div(gross).mul(100).toDecimalPlaces(1).toNumber() : 0,
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Pricing Configuration</h1>
        {saveStatus && <p className="mt-2 text-sm text-trust">{saveStatus}</p>}
      </div>

      {/* Rates (read only: code, not configuration) */}
      <section className="bg-surface rounded-xl border border-line p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Rates</h2>
        <p className="text-xs text-ink-3 mb-4">
          Set in code (src/lib/pricing/rates.ts). Changing a rate is a code change, ruled before it
          ships.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-3">Commission, regular, deep and same-day</dt>
          <dd className="font-medium">{pct(COMMISSION_RATES.regular)}</dd>
          <dt className="text-ink-3">Commission, end of tenancy and Airbnb</dt>
          <dd className="font-medium">{pct(COMMISSION_RATES.eot)}</dd>
          <dt className="text-ink-3">Customer service fee (checkout only)</dt>
          <dd className="font-medium">{pct(PLATFORM_FEE_RATE)}</dd>
          <dt className="text-ink-3">Products add-on</dt>
          <dd className="font-medium">
            &pound;{PRODUCTS_FEE}, cleaner keeps {pct(1 - PRODUCTS_FEE_COMMISSION_RATE)}
          </dd>
          <dt className="text-ink-3">Other add-ons</dt>
          <dd className="font-medium">
            Parent service&apos;s share unless the add-on sets its own
          </dd>
        </dl>
      </section>

      {/* Platform Config Panel */}
      <section className="bg-surface rounded-xl border border-line p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Platform Config</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left py-2 px-3 font-medium text-ink-3">Key</th>
                <th className="text-left py-2 px-3 font-medium text-ink-3">Value</th>
                <th className="text-left py-2 px-3 font-medium text-ink-3">Description</th>
                <th className="text-right py-2 px-3 font-medium text-ink-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-line">
                  <td className="py-2 px-3 font-mono text-xs text-ink-2">{c.key}</td>
                  <td className="py-2 px-3">
                    {editingKey === c.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 rounded border border-line px-2 py-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono text-sm">{c.value}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-ink-3 text-xs">{c.description}</td>
                  <td className="py-2 px-3 text-right">
                    {editingKey === c.key ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleSave(c.key, editValue)}
                          className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="rounded bg-line px-3 py-1 text-xs text-ink-2 hover:bg-line"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : EDITABLE.has(c.key) ? (
                      <button
                        onClick={() => {
                          setEditingKey(c.key);
                          setEditValue(c.value);
                        }}
                        className="rounded bg-page px-3 py-1 text-xs text-ink-2 hover:bg-line"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-xs text-ink-3">System</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Margin Calculator */}
      <section className="bg-surface rounded-xl border border-line p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Margin Calculator</h2>
        <p className="text-sm text-ink-3 mb-4">
          Estimated Rena revenue at current config (3hr regular booking)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left py-2 px-3 font-medium text-ink-3">Cleaner Rate</th>
                <th className="text-left py-2 px-3 font-medium text-ink-3">Gross</th>
                <th className="text-left py-2 px-3 font-medium text-ink-3">Rena Earns</th>
                <th className="text-left py-2 px-3 font-medium text-ink-3">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {[14, 20, 35].map((rate) => {
                const m = calcMargin(rate, 3);
                return (
                  <tr key={rate} className="border-b border-line">
                    <td className="py-2 px-3">&pound;{rate}/hr</td>
                    <td className="py-2 px-3">&pound;{m.gross.toFixed(2)}</td>
                    <td className="py-2 px-3 font-medium text-trust">
                      &pound;{m.renaEarns.toFixed(2)}
                    </td>
                    <td className="py-2 px-3">{m.marginPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
