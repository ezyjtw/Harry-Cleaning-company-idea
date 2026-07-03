'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import {
  SERVICE_TYPE_SLUGS,
  SERVICE_RATE_INFO,
  EOT_SIZES_WITH_GUIDE,
  AIRBNB_SIZES_WITH_GUIDE,
  serviceTypeLabel,
  eotSizeLabel,
  airbnbSizeLabel,
  type ServiceTypeSlug,
} from '@/lib/constants/services';

export default function CleanerPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeSlug[]>([]);
  const [hourlyRateRegular, setHourlyRateRegular] = useState('');
  const [hourlyRateDeep, setHourlyRateDeep] = useState('');
  const [hourlyRateSameDay, setHourlyRateSameDay] = useState('');
  const [eotPrices, setEotPrices] = useState<Record<string, string>>({});
  const [airbnbPrices, setAirbnbPrices] = useState<Record<string, string>>({});
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
        setServiceTypes(data.serviceTypes || []);
        setHourlyRateRegular(data.hourlyRateRegular ? String(data.hourlyRateRegular) : '');
        setHourlyRateDeep(data.hourlyRateDeep ? String(data.hourlyRateDeep) : '');
        setHourlyRateSameDay(data.hourlyRateSameDay ? String(data.hourlyRateSameDay) : '');
        if (data.eotPrices && typeof data.eotPrices === 'object') {
          const parsed: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.eotPrices)) {
            parsed[k] = String(v);
          }
          setEotPrices(parsed);
        }
        if (data.airbnbPrices && typeof data.airbnbPrices === 'object') {
          const parsed: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.airbnbPrices)) {
            parsed[k] = String(v);
          }
          setAirbnbPrices(parsed);
        }
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

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

  const toggleService = (slug: ServiceTypeSlug) => {
    setServiceTypes((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]
    );
    markDirty();
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      const eotNumeric: Record<string, number> = {};
      for (const [k, v] of Object.entries(eotPrices)) {
        if (v) eotNumeric[k] = Number(v);
      }
      const airbnbNumeric: Record<string, number> = {};
      for (const [k, v] of Object.entries(airbnbPrices)) {
        if (v) airbnbNumeric[k] = Number(v);
      }

      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypes,
          hourlyRateRegular: hourlyRateRegular ? Number(hourlyRateRegular) : null,
          hourlyRateDeep: hourlyRateDeep ? Number(hourlyRateDeep) : null,
          hourlyRateSameDay: hourlyRateSameDay ? Number(hourlyRateSameDay) : null,
          eotPrices: Object.keys(eotNumeric).length > 0 ? eotNumeric : null,
          airbnbPrices: Object.keys(airbnbNumeric).length > 0 ? airbnbNumeric : null,
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
  }, [
    serviceTypes,
    hourlyRateRegular,
    hourlyRateDeep,
    hourlyRateSameDay,
    eotPrices,
    airbnbPrices,
    hoursPerWeek,
  ]);

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

  const serviceToState: Record<string, { value: string; setter: (v: string) => void }> = {
    regular: { value: hourlyRateRegular, setter: setHourlyRateRegular },
    deep: { value: hourlyRateDeep, setter: setHourlyRateDeep },
    ...(SAME_DAY_FEATURE_ENABLED
      ? { same_day: { value: hourlyRateSameDay, setter: setHourlyRateSameDay } }
      : {}),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Pricing</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Manage your rates and the services you offer
        </p>
      </div>

      {dirty && (
        <div
          className="mb-6 flex items-center justify-between rounded-xl bg-warning/10 px-5 py-3"
          style={{ border: '1px solid rgb(var(--color-warning) / 0.2)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-warning"
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
            <span className="font-jost text-sm text-warning">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full px-4 py-1.5 bg-primary text-white font-jost text-[12px] font-light hover:bg-primary-hover transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save now'}
          </button>
        </div>
      )}

      {saveError && (
        <div
          className="mb-6 rounded-xl bg-danger/10 px-5 py-3"
          style={{ border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <p className="font-jost text-sm text-danger">{saveError}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Service types */}
        <div className="bg-page p-6" style={{ border: '0.5px solid rgb(var(--color-border))' }}>
          <h2 className="font-newsreader text-lg font-semibold text-ink mb-2">Services Offered</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-4">
            Select the cleaning services you want to offer
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPE_SLUGS.filter((s) => SAME_DAY_FEATURE_ENABLED || s !== 'same_day').map(
              (slug) => {
                const info = SERVICE_RATE_INFO[slug];
                return (
                  <button
                    key={slug}
                    onClick={() => toggleService(slug)}
                    className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                      serviceTypes.includes(slug)
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface text-ink-2 hover:bg-primary-soft'
                    }`}
                    style={
                      serviceTypes.includes(slug)
                        ? undefined
                        : { border: '1px solid rgb(var(--color-border))' }
                    }
                  >
                    {serviceTypes.includes(slug) && (
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
                    {info.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Per-service hourly rates */}
        {serviceTypes.filter((s) => SERVICE_RATE_INFO[s]?.hourly).length > 0 && (
          <div className="bg-page p-6" style={{ border: '0.5px solid rgb(var(--color-border))' }}>
            <h2 className="font-newsreader text-lg font-semibold text-ink mb-2">Hourly Rates</h2>
            <p className="font-jost text-sm font-light text-ink-2 mb-4">
              Set your hourly rate for each service type you offer
            </p>
            <div className="space-y-4">
              {serviceTypes
                .filter((svc) => SERVICE_RATE_INFO[svc]?.hourly)
                .map((svc) => {
                  const info = SERVICE_RATE_INFO[svc];
                  const mapping = serviceToState[svc];
                  if (!mapping) return null;
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
                          min="14"
                          step="0.50"
                          value={mapping.value}
                          onChange={(e) => {
                            mapping.setter(e.target.value);
                            markDirty();
                          }}
                          placeholder="—"
                          className="w-full rounded-lg bg-surface py-2.5 pl-8 pr-4 font-jost text-[14px] font-light text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                          style={{ border: '1px solid rgb(var(--color-border))' }}
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

        {/* EOT & Airbnb fixed-price tables */}
        {(serviceTypes.includes('end_of_tenancy') || serviceTypes.includes('airbnb')) && (
          <div className="bg-page p-6" style={{ border: '0.5px solid rgb(var(--color-border))' }}>
            <h2 className="font-newsreader text-lg font-semibold text-ink mb-2">
              Fixed-Price Services
            </h2>
            <p className="font-jost text-sm font-light text-ink-2 mb-5">
              Set your prices for each property size. The guide shows typical rates on Rena.
            </p>

            {serviceTypes.includes('end_of_tenancy') && (
              <div className="mb-6">
                <h3 className="font-newsreader text-sm font-semibold text-ink mb-3">
                  {serviceTypeLabel('end_of_tenancy')}
                </h3>
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: '0.5px solid rgb(var(--color-border))' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-primary-soft">
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
                      {EOT_SIZES_WITH_GUIDE.map((row) => (
                        <tr
                          key={row.slug}
                          style={{ borderTop: '0.5px solid rgb(var(--color-border))' }}
                        >
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                            {eotSizeLabel(row.slug)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                £
                              </span>
                              <input
                                type="number"
                                placeholder="—"
                                value={eotPrices[row.slug] || ''}
                                className="w-24 rounded-lg pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
                                style={{ border: '0.5px solid rgb(var(--color-border))' }}
                                onChange={(e) => {
                                  setEotPrices((prev) => ({
                                    ...prev,
                                    [row.slug]: e.target.value,
                                  }));
                                  markDirty();
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                            {row.guide}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {serviceTypes.includes('airbnb') && (
              <div className="mb-6">
                <h3 className="font-newsreader text-sm font-semibold text-ink mb-3">
                  {serviceTypeLabel('airbnb')}
                </h3>
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: '0.5px solid rgb(var(--color-border))' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-primary-soft">
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
                      {AIRBNB_SIZES_WITH_GUIDE.map((row) => (
                        <tr
                          key={row.slug}
                          style={{ borderTop: '0.5px solid rgb(var(--color-border))' }}
                        >
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink">
                            {airbnbSizeLabel(row.slug)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-jost text-sm text-ink-3">
                                £
                              </span>
                              <input
                                type="number"
                                placeholder="—"
                                value={airbnbPrices[row.slug] || ''}
                                className="w-24 rounded-lg pl-6 pr-2 py-1.5 font-jost text-sm font-light text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
                                style={{ border: '0.5px solid rgb(var(--color-border))' }}
                                onChange={(e) => {
                                  setAirbnbPrices((prev) => ({
                                    ...prev,
                                    [row.slug]: e.target.value,
                                  }));
                                  markDirty();
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-jost text-sm font-light text-ink-3">
                            {row.guide}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div
              className="rounded-xl bg-primary-soft/50 p-5"
              style={{ border: '1px solid rgb(var(--color-border))' }}
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
        <div className="bg-page p-6" style={{ border: '0.5px solid rgb(var(--color-border))' }}>
          <h2 className="font-newsreader text-lg font-semibold text-ink mb-4">
            Typical Working Hours
          </h2>
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
              className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              style={{ border: '1px solid rgb(var(--color-border))' }}
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
            <span className="font-jost text-sm font-light text-trust flex items-center gap-1">
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
            className="rounded-full px-8 py-2.5 bg-primary text-white font-jost text-[13px] font-light shadow-sm hover:bg-primary-hover transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}
