'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const SERVICE_RATE_INFO: Record<string, { label: string; range: string; hourly: boolean }> = {
  Standard: { label: 'Regular Cleaning', range: '£14 – £35/hr', hourly: true },
  Deep: { label: 'Deep Cleaning', range: '£20 – £51/hr', hourly: true },
  'Same Day': { label: 'Same-Day Cleaning', range: '£18 – £46/hr', hourly: true },
  'End of Tenancy': { label: 'End of Tenancy', range: '£150 – £580', hourly: false },
  AirBnB: { label: 'Airbnb / Short-Let', range: '£45 – £165', hourly: false },
};

const specialtyOptions = ['Standard', 'Deep', 'Same Day', 'End of Tenancy', 'AirBnB'];

export default function CleanerPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('15');
  const [rateError, setRateError] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [serviceRates, setServiceRates] = useState<Record<string, string>>({});
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setHourlyRate(String(data.hourlyRate || 15));
        setServiceTypes(data.serviceTypes || []);
        setServiceRates(data.serviceRates || {});
        setHoursPerWeek(String(data.hoursPerWeek || ''));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
    setSaveError('');
  }, []);

  // Warn on browser close/refresh with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Intercept sidebar link clicks when dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '/cleaner/pricing') return;
      if (href.startsWith('/cleaner') || href === '/') {
        // eslint-disable-next-line no-alert
        const ok = window.confirm('You have unsaved changes. Leave without saving?');
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [dirty]);

  const toggleService = (s: string) => {
    setServiceTypes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    markDirty();
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hourlyRate: Number(hourlyRate),
          serviceTypes,
          serviceRates,
          hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error || 'Failed to save. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please check your connection and try again.');
    }
    setSaving(false);
  }, [hourlyRate, serviceTypes, serviceRates, hoursPerWeek]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 w-32" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-ink/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Pricing</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Manage your rates and the services you offer
        </p>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div
          className="mb-6 flex items-center justify-between rounded-xl bg-amber-50 px-5 py-3"
          style={{ border: '1px solid rgba(217,119,6,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              />
            </svg>
            <span className="font-jost text-sm text-amber-800">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save now'}
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div
          className="mb-6 rounded-xl bg-red-50 px-5 py-3"
          style={{ border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <p className="font-jost text-sm text-red-700">{saveError}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Service types */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-2">Services Offered</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-4">
            Select the cleaning services you want to offer
          </p>
          <div className="flex flex-wrap gap-2">
            {specialtyOptions.map((s) => (
              <button
                key={s}
                onClick={() => toggleService(s)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  serviceTypes.includes(s)
                    ? 'bg-ink text-cream shadow-sm'
                    : 'bg-white text-ink-2 hover:bg-cream-2'
                }`}
                style={
                  serviceTypes.includes(s) ? undefined : { border: '1px solid rgba(14,14,12,0.1)' }
                }
              >
                {serviceTypes.includes(s) && (
                  <svg
                    className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {SERVICE_RATE_INFO[s]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {/* Base hourly rate */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Base Hourly Rate</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-jost text-sm font-light text-ink-2">
                £
              </span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => {
                  const val = e.target.value;
                  setHourlyRate(val);
                  markDirty();
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    if (num < 14) setRateError('Minimum rate on Rena is £14/hr');
                    else if (num > 35) setRateError('Rates above £35/hr require admin review');
                    else setRateError('');
                  }
                }}
                min="14"
                max="35"
                className="w-32 rounded-lg pl-7 pr-4 py-2.5 font-jost font-light text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>
            <span className="font-jost text-sm font-light text-ink-2">per hour</span>
          </div>
          {rateError && <p className="font-jost text-sm text-red-500 mt-2">{rateError}</p>}
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
            Suggested range: £15–£22/hr
          </p>
        </div>

        {/* Per-service rates */}
        {serviceTypes.filter((s) => SERVICE_RATE_INFO[s]?.hourly).length > 0 && (
          <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-cormorant text-lg font-light text-ink mb-2">Per-Service Rates</h2>
            <p className="font-jost text-sm font-light text-ink-2 mb-4">
              Set your hourly rate for each service type you offer
            </p>
            <div className="space-y-4">
              {serviceTypes
                .filter((svc) => SERVICE_RATE_INFO[svc]?.hourly)
                .map((svc) => {
                  const info = SERVICE_RATE_INFO[svc];
                  return (
                    <div key={svc}>
                      <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                        {info.label}
                      </label>
                      <div className="relative mt-1.5">
                        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-jost text-[14px] font-light text-ink-3">
                          £
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="0.50"
                          value={serviceRates[svc] || ''}
                          onChange={(e) => {
                            setServiceRates((prev) => ({
                              ...prev,
                              [svc]: e.target.value,
                            }));
                            markDirty();
                          }}
                          placeholder="—"
                          className="w-full rounded-lg bg-white py-2.5 pl-8 pr-4 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                          style={{ border: '1px solid rgba(14,14,12,0.1)' }}
                        />
                      </div>
                      <p className="mt-1 font-jost text-[11px] text-ink-3">
                        Typical range: {info.range}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* EOT & Airbnb Pricing */}
        {(serviceTypes.includes('End of Tenancy') || serviceTypes.includes('AirBnB')) && (
          <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-cormorant text-lg font-light text-ink mb-2">
              Fixed-Price Services
            </h2>
            <p className="font-jost text-sm font-light text-ink-2 mb-5">
              Set your prices for each property size. The guide shows typical rates on Rena.
            </p>

            {serviceTypes.includes('End of Tenancy') && (
              <div className="mb-6">
                <h3 className="font-jost text-sm font-medium text-ink mb-3">End of Tenancy</h3>
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-cream-2">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Property
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Your price
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Rena guide
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Studio', guide: '£150 – £200' },
                        { label: '1 bed', guide: '£190 – £240' },
                        { label: '2 bed', guide: '£250 – £300' },
                        { label: '3 bed', guide: '£320 – £380' },
                        { label: '4 bed', guide: '£390 – £450' },
                        { label: '5 bed+', guide: '£480 – £580' },
                      ].map((row) => {
                        const key = `eot_${row.label}`;
                        return (
                          <tr
                            key={row.label}
                            style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                          >
                            <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                              {row.label}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                  £
                                </span>
                                <input
                                  type="number"
                                  placeholder="—"
                                  value={serviceRates[key] || ''}
                                  className="w-24 rounded-lg pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-white focus:outline-none focus:ring-1 focus:ring-gold/30"
                                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                                  onChange={(e) => {
                                    setServiceRates((prev) => ({ ...prev, [key]: e.target.value }));
                                    markDirty();
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                              {row.guide}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {serviceTypes.includes('AirBnB') && (
              <div className="mb-6">
                <h3 className="font-jost text-sm font-medium text-ink mb-3">Airbnb / Short-Let</h3>
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-cream-2">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Property
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Your price
                        </th>
                        <th className="px-4 py-2.5 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal">
                          Rena guide
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Studio', guide: '£45 – £65' },
                        { label: '1 bed', guide: '£55 – £85' },
                        { label: '2 bed', guide: '£75 – £110' },
                        { label: '3 bed', guide: '£95 – £140' },
                        { label: '4 bed+', guide: '£130 – £165' },
                      ].map((row) => {
                        const key = `airbnb_${row.label}`;
                        return (
                          <tr
                            key={row.label}
                            style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                          >
                            <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                              {row.label}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                  £
                                </span>
                                <input
                                  type="number"
                                  placeholder="—"
                                  value={serviceRates[key] || ''}
                                  className="w-24 rounded-lg pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-white focus:outline-none focus:ring-1 focus:ring-gold/30"
                                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                                  onChange={(e) => {
                                    setServiceRates((prev) => ({ ...prev, [key]: e.target.value }));
                                    markDirty();
                                  }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                              {row.guide}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div
              className="rounded-xl bg-cream-2/50 p-5"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <p className="font-jost text-sm font-medium text-ink mb-2">How fees work</p>
              <p className="font-jost text-sm font-light text-ink-2 leading-relaxed">
                Fixed-price services (End of Tenancy &amp; Airbnb) have a 15% platform fee instead
                of the usual 10%, due to our pricing model.
              </p>
            </div>
          </div>
        )}

        {/* Hours per week */}
        <div className="bg-cream p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Typical Working Hours</h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={hoursPerWeek}
              onChange={(e) => {
                setHoursPerWeek(e.target.value);
                markDirty();
              }}
              min="1"
              max="80"
              placeholder="e.g. 20"
              className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
              style={{ border: '1px solid rgba(14,14,12,0.1)' }}
            />
            <span className="font-jost text-sm font-light text-ink-2">hours per week</span>
          </div>
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
            Helps us match you with the right number of bookings
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="font-jost text-sm font-light text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Pricing saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full px-8 py-2.5 bg-ink text-cream font-jost text-[13px] font-light shadow-sm hover:bg-ink/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}
