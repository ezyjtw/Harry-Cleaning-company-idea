'use client';

import { useEffect, useRef, useState } from 'react';

import { isValidPostcode } from '@/lib/utils/postcode';

// A12: postcode → getAddress.io lookup → pick a real address, with a resilient
// manual-entry fallback. The component NEVER touches the API key — it calls our
// server proxy (/api/address/lookup), which holds the key server-side. If the
// lookup is unavailable (no key configured / postcode not found / upstream down),
// it transparently drops to manual structured entry so a getAddress outage can
// never block a booking.
//
// Two modes:
//   • free (book/[id]): the user types a postcode + "Find address".
//   • auto (services/[category]): pass `autoLookupPostcode` — the postcode already
//     entered at the start. The component auto-runs the lookup on mount and shows
//     the address dropdown directly (no second postcode box). "Change postcode"
//     re-validates via `onPostcodeChange`; if the chosen cleaner doesn't cover the
//     new area, `onReselectCleaner` bounces the user back to cleaner selection.

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

export interface PostcodeChangeVerdict {
  accepted: boolean;
  message?: string;
}

interface Props {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /** Seed the postcode search field (free mode). */
  initialPostcode?: string;
  /** Auto-lookup mode: the postcode already entered earlier in the flow. */
  autoLookupPostcode?: string;
  /** Validate a postcode change (auto mode). Return accepted=false to block the
   *  lookup and surface a message (e.g. chosen cleaner doesn't cover the area). */
  onPostcodeChange?: (postcode: string) => PostcodeChangeVerdict;
  /** Bounce to cleaner selection for a new postcode (auto mode, after a reject). */
  onReselectCleaner?: (postcode: string) => void;
}

export default function AddressAutocomplete({
  value,
  onChange,
  initialPostcode,
  autoLookupPostcode,
  onPostcodeChange,
  onReselectCleaner,
}: Props) {
  const autoMode = !!autoLookupPostcode;

  const [query, setQuery] = useState(value.postcode || initialPostcode || '');
  const [activePostcode, setActivePostcode] = useState(
    (autoLookupPostcode || value.postcode || '').toUpperCase()
  );
  const [results, setResults] = useState<LookupAddress[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  // Auto-mode "Change postcode" sub-flow.
  const [changing, setChanging] = useState(false);
  const [changePc, setChangePc] = useState('');
  const [coverageMsg, setCoverageMsg] = useState<string | null>(null);
  const [pendingPc, setPendingPc] = useState('');

  const fieldStyle = { border: '0.5px solid rgba(14,14,12,0.1)' } as const;
  const inputCls =
    'mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20';
  const linkCls = 'font-jost text-xs font-light text-ink-3 underline hover:text-ink';

  function dropToManual(postcode: string) {
    setManual(true);
    onChange({ ...value, postcode: postcode.trim().toUpperCase() });
  }

  async function runLookup(pc: string) {
    const p = pc.trim();
    setError(null);
    setResults(null);
    setCoverageMsg(null);
    setChanging(false);
    if (!isValidPostcode(p)) {
      setError('Please enter a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setActivePostcode(p.toUpperCase());
    setManual(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/address/lookup?postcode=${encodeURIComponent(p)}`);
      if (res.ok) {
        const data = (await res.json()) as { addresses?: LookupAddress[] };
        if (data.addresses && data.addresses.length > 0) {
          setResults(data.addresses);
        } else {
          dropToManual(p);
          setError('No addresses found for that postcode. Please enter your address below.');
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        dropToManual(p);
        setError(data.error || 'Address lookup is unavailable. Please enter your address below.');
      }
    } catch {
      dropToManual(p);
      setError('Address lookup is unavailable. Please enter your address below.');
    } finally {
      setLoading(false);
    }
  }

  // Auto mode: run the lookup once for the carried-through postcode.
  const autoRanFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoLookupPostcode || value.line1) return;
    if (autoRanFor.current === autoLookupPostcode) return;
    autoRanFor.current = autoLookupPostcode;
    if (isValidPostcode(autoLookupPostcode)) {
      runLookup(autoLookupPostcode);
    } else {
      dropToManual(autoLookupPostcode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookupPostcode, value.line1]);

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

  function handleChangeSelected() {
    onChange({ line1: '', line2: '', city: '', postcode: value.postcode });
    if (autoMode) runLookup(value.postcode || activePostcode);
  }

  function submitPostcodeChange() {
    const p = changePc.trim().toUpperCase();
    if (!isValidPostcode(p)) {
      setError('Please enter a valid UK postcode (e.g. SW1A 1AA).');
      return;
    }
    setError(null);
    if (onPostcodeChange) {
      const verdict = onPostcodeChange(p);
      if (verdict.accepted) {
        runLookup(p);
      } else {
        setCoverageMsg(verdict.message || "That cleaner doesn't cover this postcode.");
        setPendingPc(p);
      }
    } else {
      runLookup(p);
    }
  }

  const addressSelect =
    results && results.length > 0 ? (
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
    ) : null;

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
            setError(null);
            if (autoMode) runLookup(value.postcode || activePostcode);
            else setManual(false);
          }}
          className={linkCls}
        >
          Search by postcode instead
        </button>
      </div>
    );
  }

  // ─── Selected address summary ───────────────────────────────
  if (value.line1) {
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3 p-3" style={fieldStyle}>
          <div className="font-jost text-sm font-light text-ink">
            <p>{value.line1}</p>
            {value.line2 && <p>{value.line2}</p>}
            <p>
              {value.city} {value.postcode}
            </p>
          </div>
          <button type="button" onClick={handleChangeSelected} className={linkCls}>
            Change
          </button>
        </div>
      </div>
    );
  }

  // ─── Auto mode: dropdown for the carried-through postcode ────
  if (autoMode) {
    if (changing) {
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={changePc}
              onChange={(e) => setChangePc(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitPostcodeChange();
                }
              }}
              placeholder="New postcode"
              className="flex-1 px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
              style={fieldStyle}
            />
            <button
              type="button"
              onClick={submitPostcodeChange}
              className="whitespace-nowrap bg-ink px-4 py-2 font-jost text-xs font-light text-cream transition hover:bg-ink/90"
            >
              Update
            </button>
          </div>
          {error && <p className="font-jost text-xs font-light text-amber-700">{error}</p>}
          {coverageMsg ? (
            <div className="space-y-2">
              <p className="font-jost text-xs font-light text-amber-700">{coverageMsg}</p>
              <button
                type="button"
                onClick={() => onReselectCleaner?.(pendingPc)}
                className="bg-gold px-4 py-2 font-jost text-xs font-medium text-white transition hover:opacity-90"
              >
                Choose another cleaner
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                setCoverageMsg(null);
              }}
              className={linkCls}
            >
              Cancel
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-jost text-xs uppercase tracking-[0.1em] text-ink-3">
            {loading
              ? `Finding addresses for ${activePostcode}…`
              : `Addresses for ${activePostcode}`}
          </p>
          {!loading && (
            <button
              type="button"
              onClick={() => {
                setChanging(true);
                setChangePc(activePostcode);
                setError(null);
                setCoverageMsg(null);
              }}
              className={linkCls}
            >
              Change postcode
            </button>
          )}
        </div>
        {addressSelect}
        {error && <p className="font-jost text-xs font-light text-amber-700">{error}</p>}
        {!loading && (
          <button type="button" onClick={() => setManual(true)} className={linkCls}>
            Enter address manually
          </button>
        )}
      </div>
    );
  }

  // ─── Free mode: postcode search box + Find (book/[id]) ───────
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runLookup(query);
            }
          }}
          placeholder="Enter postcode"
          className="flex-1 px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
          style={fieldStyle}
        />
        <button
          type="button"
          onClick={() => runLookup(query)}
          disabled={loading}
          className="whitespace-nowrap bg-ink px-4 py-2 font-jost text-xs font-light text-cream transition hover:bg-ink/90 disabled:opacity-50"
        >
          {loading ? 'Finding…' : 'Find address'}
        </button>
      </div>
      {addressSelect}
      {error && <p className="font-jost text-xs font-light text-amber-700">{error}</p>}
      <button type="button" onClick={() => setManual(true)} className={linkCls}>
        Enter address manually
      </button>
    </div>
  );
}
