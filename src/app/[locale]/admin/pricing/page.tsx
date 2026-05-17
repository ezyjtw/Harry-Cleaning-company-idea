'use client';

import Decimal from 'decimal.js';
import { useCallback, useEffect, useState } from 'react';

interface PlatformConfigEntry {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface FixedPrice {
  propertySize: string;
  estimatedHours: number;
  customerPrice: number;
}

interface ServiceTypeEntry {
  id: string;
  slug: string;
  name: string;
  pricingModel: string;
  baseMultiplier: number;
  fixedPrices: FixedPrice[];
}

const PROPERTY_SIZE_LABELS: Record<string, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bed',
  TWO_BED: '2 Bed',
  THREE_BED: '3 Bed',
  FOUR_BED: '4 Bed',
  FIVE_PLUS: '5+ Bed',
};

export default function AdminPricingPage() {
  const [configs, setConfigs] = useState<PlatformConfigEntry[]>([]);
  const [services, setServices] = useState<ServiceTypeEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [configRes, servicesRes] = await Promise.all([
        fetch('/api/admin/pricing/config'),
        fetch('/api/pricing/services'),
      ]);
      if (configRes.ok) setConfigs(await configRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
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
      }
    } catch {
      setSaveStatus('Failed to save');
    }
  };

  // Margin calculator
  const getConfig = (key: string): number => {
    const c = configs.find((c) => c.key === key);
    return c ? parseFloat(c.value) : 0;
  };

  const cleanerFeePct = getConfig('cleaner_fee_pct');
  const customerFeePct = getConfig('customer_fee_pct');

  const calcMargin = (rate: number, hours: number, multiplier: number) => {
    const gross = new Decimal(rate).mul(hours).mul(multiplier);
    const cleanerFee = gross.mul(cleanerFeePct);
    const customerFee = gross.mul(customerFeePct);
    const renaTotal = cleanerFee.plus(customerFee);
    return {
      gross: gross.toDecimalPlaces(2).toNumber(),
      renaEarns: renaTotal.toDecimalPlaces(2).toNumber(),
      marginPct: gross.gt(0) ? renaTotal.div(gross).mul(100).toDecimalPlaces(1).toNumber() : 0,
    };
  };

  const fixedServices = services.filter((s) => s.pricingModel === 'FIXED');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage platform fees, multipliers, and fixed prices
        </p>
        {saveStatus && <p className="mt-2 text-sm text-green-600">{saveStatus}</p>}
      </div>

      {/* Platform Config Panel */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Config</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Key</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Value</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Description</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 px-3 font-mono text-xs text-gray-700">{c.key}</td>
                  <td className="py-2 px-3">
                    {editingKey === c.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono text-sm">{c.value}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-500 text-xs">{c.description}</td>
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
                          className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingKey(c.key);
                          setEditValue(c.value);
                        }}
                        className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fixed Price Editor */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Fixed Prices (EOT &amp; Airbnb)
        </h2>
        {fixedServices.map((svc) => (
          <div key={svc.id} className="mb-6 last:mb-0">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{svc.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Property</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Est. Hours</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">
                      Customer Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {svc.fixedPrices.map((fp) => (
                    <tr key={fp.propertySize} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        {PROPERTY_SIZE_LABELS[fp.propertySize] ?? fp.propertySize}
                      </td>
                      <td className="py-2 px-3">{fp.estimatedHours} hrs</td>
                      <td className="py-2 px-3 font-medium">&pound;{fp.customerPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Margin Calculator */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Margin Calculator</h2>
        <p className="text-sm text-gray-500 mb-4">
          Estimated Rena revenue at current config (3hr regular booking)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Cleaner Rate</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Gross</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Rena Earns</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {[14, 20, 35].map((rate) => {
                const m = calcMargin(rate, 3, 1.0);
                return (
                  <tr key={rate} className="border-b border-gray-100">
                    <td className="py-2 px-3">&pound;{rate}/hr</td>
                    <td className="py-2 px-3">&pound;{m.gross.toFixed(2)}</td>
                    <td className="py-2 px-3 font-medium text-green-600">
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
