'use client';

// Appearance item 3 (James-ruled): the RATES ROOM, built on the corrected
// truth — every price is cleaner-set; Rena's hand is the floors. Steppers for
// the Regular and Deep hourly rates (£14 floor, shown as the hint); per-size
// price fields for EOT and Airbnb where she offers them (their floors as
// hints); the ruled effect line; SAVE writes through the existing
// PUT /api/cleaner/profile with its validations untouched — a sub-floor save
// is refused by the server and its honest message shown here.

import { useEffect, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';
import { haptic } from '@/components/app/job-cards';

const MIN_HOURLY = 14;
const EOT_FLOORS: Record<string, number> = {
  studio: 75,
  '1bed': 95,
  '2bed': 125,
  '3bed': 160,
  '4bed': 195,
  '5bedPlus': 240,
};
const AIRBNB_FLOORS: Record<string, number> = {
  studio: 22.5,
  '1bed': 27.5,
  '2bed': 37.5,
  '3bed': 47.5,
  '4bedPlus': 65,
};
const SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1bed': '1 bedroom',
  '2bed': '2 bedrooms',
  '3bed': '3 bedrooms',
  '4bed': '4 bedrooms',
  '4bedPlus': '4+ bedrooms',
  '5bedPlus': '5+ bedrooms',
};

const fmtRate = (v: number) => (Number.isInteger(v) ? `£${v}` : `£${v.toFixed(2)}`);

function HourlyStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = 0.5;
  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="min-w-0">
        <span className="block font-jost text-[15px] font-medium text-ink">{label}</span>
        <span className="block font-jost text-[12px] text-ink-3">Minimum £{MIN_HOURLY}/hr</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Lower ${label}`}
          disabled={value - step < MIN_HOURLY}
          onClick={() => {
            haptic('light');
            onChange(Math.max(MIN_HOURLY, Math.round((value - step) * 100) / 100));
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-jost text-[18px] text-ink disabled:opacity-30"
        >
          −
        </button>
        <span
          className="w-[76px] text-center font-jost text-[17px] font-semibold text-ink"
          data-testid={`rate-${label.toLowerCase().replace(/\s/g, '-')}`}
        >
          {fmtRate(value)}/hr
        </span>
        <button
          type="button"
          aria-label={`Raise ${label}`}
          onClick={() => {
            haptic('light');
            onChange(Math.round((value + step) * 100) / 100);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-jost text-[18px] text-ink"
        >
          +
        </button>
      </span>
    </div>
  );
}

export default function RatesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [regular, setRegular] = useState<number | null>(null);
  const [deep, setDeep] = useState<number | null>(null);
  const [eot, setEot] = useState<Record<string, string>>({});
  const [airbnb, setAirbnb] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setLoadError(true);
          return;
        }
        setServiceTypes(Array.isArray(d.serviceTypes) ? d.serviceTypes : []);
        if (typeof d.hourlyRateRegular === 'number') setRegular(d.hourlyRateRegular);
        if (typeof d.hourlyRateDeep === 'number') setDeep(d.hourlyRateDeep);
        const toStrings = (obj: unknown): Record<string, string> => {
          const out: Record<string, string> = {};
          if (obj && typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              if (typeof v === 'number') out[k] = String(v);
            }
          }
          return out;
        };
        setEot(toStrings(d.eotPrices));
        setAirbnb(toStrings(d.airbnbPrices));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const offers = (s: string) => serviceTypes.includes(s);

  const save = async () => {
    if (saving) return;
    haptic('light');
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const numMap = (m: Record<string, string>): Record<string, number> => {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(m)) {
          if (v.trim() !== '') out[k] = Number(v);
        }
        return out;
      };
      const body: Record<string, unknown> = {};
      if (offers('regular') && regular !== null) body.hourlyRateRegular = regular;
      if (offers('deep') && deep !== null) body.hourlyRateDeep = deep;
      if (offers('eot')) body.eotPrices = numMap(eot);
      if (offers('airbnb')) body.airbnbPrices = numMap(airbnb);
      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error || 'Could not save your rates. Please try again.');
        return;
      }
      setSaved(true);
      haptic('medium');
    } catch {
      setSaveError('Could not save your rates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fixedBlock = (
    slug: 'eot' | 'airbnb',
    title: string,
    floors: Record<string, number>,
    values: Record<string, string>,
    setValues: (v: Record<string, string>) => void
  ) =>
    offers(slug) ? (
      <section className="rounded-2xl border border-line bg-surface px-5 py-2" key={slug}>
        <h2 className="pt-3 font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {title}
        </h2>
        <div className="divide-y divide-line/60">
          {Object.entries(floors).map(([size, floor]) => (
            <div key={size} className="flex items-center justify-between py-3">
              <span className="min-w-0">
                <span className="block font-jost text-[15px] font-medium text-ink">
                  {SIZE_LABELS[size] ?? size}
                </span>
                <span className="block font-jost text-[12px] text-ink-3">
                  Minimum {fmtRate(floor)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-jost text-[16px] font-semibold text-ink">
                £
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[size] ?? ''}
                  onChange={(e) => setValues({ ...values, [size]: e.target.value })}
                  data-testid={`price-${slug}-${size}`}
                  className="w-[84px] rounded-[10px] border border-line bg-page px-3 py-2 text-right font-jost text-[15px] font-medium text-ink focus:border-primary focus:outline-none"
                />
              </span>
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">My Rates</h1>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <AccountMenu />
            <InboxBell />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
          <div className="h-28 animate-pulse rounded-2xl bg-line" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="font-jost text-sm text-ink-2">
            Couldn&apos;t load your rates. Check your connection and try again.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(offers('regular') || offers('deep')) && (
            <section className="rounded-2xl border border-line bg-surface px-5 py-1">
              <div className="divide-y divide-line/60">
                {offers('regular') && regular !== null && (
                  <HourlyStepper label="Regular Cleaning" value={regular} onChange={setRegular} />
                )}
                {offers('deep') && deep !== null && (
                  <HourlyStepper label="Deep Cleaning" value={deep} onChange={setDeep} />
                )}
              </div>
            </section>
          )}

          {fixedBlock('eot', 'End of Tenancy', EOT_FLOORS, eot, setEot)}
          {fixedBlock('airbnb', 'Airbnb Cleaning', AIRBNB_FLOORS, airbnb, setAirbnb)}

          {/* The ruled effect line, verbatim. */}
          <p className="px-1 font-jost text-[13px] text-ink-3" data-testid="rates-effect-line">
            New prices apply to new bookings only. Nothing already booked changes.
          </p>

          {saveError && (
            <div
              className="rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-3"
              data-testid="rates-save-error"
            >
              <p className="font-jost text-[13px] text-danger">{saveError}</p>
            </div>
          )}
          {saved && !saveError && (
            <p className="px-1 font-jost text-[13px] font-medium text-trust">Rates saved.</p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            data-testid="rates-save"
            className="w-full rounded-[10px] bg-primary py-3.5 font-jost text-[13px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
