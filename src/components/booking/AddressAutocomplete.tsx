'use client';

import { useState } from 'react';

import { isValidPostcode } from '@/lib/utils/postcode';

// A12 (Stage 2): postcode → getAddress.io lookup → pick a real address, with a
// resilient manual-entry fallback. The component NEVER touches the API key — it
// calls our server proxy (/api/address/lookup), which holds the key server-side.
// If the lookup is unavailable (no key configured / postcode not found / upstream
// down), it transparently drops to manual structured entry so a getAddress
// outage can never block a booking.

export interface AddressValue {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
}

interface LookupAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
}

interface Props {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /** Seed the postcode search field (e.g. the postcode entered earlier in the flow). */
  initialPostcode?: string;
}

export default function AddressAutocomplete({ value, onChange, initialPostcode }: Props) {
  const [query, setQuery] = useState(value.postcode || initialPostcode || '');
  const [results, setResults] = useState<LookupAddress[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  async function handleFind() {
    setError(null);
    setResults(null);
    if (!isValidPostcode(query)) {
      setError('Please enter a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/address/lookup?postcode=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as { addresses?: LookupAddress[] };
        if (data.addresses && data.addresses.length > 0) {
          setResults(data.addresses);
        } else {
          // Found postcode but no addresses — let them type it.
          dropToManual(query);
          setError('No addresses found for that postcode. Please enter your address below.');
        }
      } else {
        // 400 (bad postcode), 404 (none), 429, 503 (no key / upstream down).
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        dropToManual(query);
        setError(data.error || 'Address lookup is unavailable. Please enter your address below.');
      }
    } catch {
      dropToManual(query);
      setError('Address lookup is unavailable. Please enter your address below.');
    } finally {
      setLoading(false);
    }
  }

  function dropToManual(postcode: string) {
    setManual(true);
    onChange({ ...value, postcode: postcode.trim().toUpperCase() });
  }

  function handleSelect(addr: LookupAddress) {
    onChange({
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      postcode: addr.postcode,
    });
    setResults(null);
    setError(null);
  }

  const fieldStyle = { border: '0.5px solid rgba(14,14,12,0.1)' } as const;
  const inputCls =
    'mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20';

  // ─── Manual entry ───────────────────────────────────────────
  if (manual) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          required
          placeholder="Address line 1"
          value={value.line1}
          onChange={(e) => onChange({ ...value, line1: e.target.value })}
          className={inputCls}
          style={fieldStyle}
        />
        <input
          type="text"
          placeholder="Address line 2 (optional)"
          value={value.line2}
          onChange={(e) => onChange({ ...value, line2: e.target.value })}
          className={inputCls}
          style={fieldStyle}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            required
            placeholder="Town / city"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            className={inputCls}
            style={fieldStyle}
          />
          <input
            type="text"
            required
            placeholder="Postcode"
            value={value.postcode}
            onChange={(e) => onChange({ ...value, postcode: e.target.value.toUpperCase() })}
            className={inputCls}
            style={fieldStyle}
          />
        </div>
        {error && <p className="font-jost text-xs font-light text-amber-700">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setManual(false);
            setError(null);
          }}
          className="font-jost text-xs font-light text-ink-3 underline hover:text-ink"
        >
          Search by postcode instead
        </button>
      </div>
    );
  }

  // ─── Postcode search ────────────────────────────────────────
  return (
    <div className="space-y-2">
      {value.line1 ? (
        // A selected address — show summary with a change affordance.
        <div className="flex items-start justify-between gap-3 p-3" style={fieldStyle}>
          <div className="font-jost text-sm font-light text-ink">
            <p>{value.line1}</p>
            {value.line2 && <p>{value.line2}</p>}
            <p>
              {value.city} {value.postcode}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ line1: '', line2: '', city: '', postcode: value.postcode })}
            className="font-jost text-xs font-light text-ink-3 underline hover:text-ink"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFind();
                }
              }}
              placeholder="Enter postcode"
              className="flex-1 px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={fieldStyle}
            />
            <button
              type="button"
              onClick={handleFind}
              disabled={loading}
              className="whitespace-nowrap bg-ink px-4 py-2 font-jost text-xs font-light text-cream transition hover:bg-ink/90 disabled:opacity-50"
            >
              {loading ? 'Finding…' : 'Find address'}
            </button>
          </div>

          {results && results.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (!Number.isNaN(idx) && results[idx]) handleSelect(results[idx]);
              }}
              className="w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={fieldStyle}
            >
              <option value="" disabled>
                Select your address ({results.length} found)
              </option>
              {results.map((a, i) => (
                <option key={i} value={i}>
                  {[a.line1, a.line2, a.city].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
          )}

          {error && <p className="font-jost text-xs font-light text-amber-700">{error}</p>}

          <button
            type="button"
            onClick={() => setManual(true)}
            className="font-jost text-xs font-light text-ink-3 underline hover:text-ink"
          >
            Enter address manually
          </button>
        </>
      )}
    </div>
  );
}
