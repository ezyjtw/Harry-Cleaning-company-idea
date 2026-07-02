'use client';

import { useEffect, useRef, useState } from 'react';

import { isValidPostcode } from '@/lib/utils/postcode';

// Manual structured address entry — the clean, intentional default.
//
// (History: this used to offer postcode→address autocomplete via a third-party
// lookup provider + a server proxy. That provider was legally shut down in Feb
// 2026, so the lookup + proxy were removed. Typed entry is now the primary path.)
//
// The postcode is pre-filled from the up-front postcode carried through the funnel
// (autoLookupPostcode / initialPostcode), so the customer rarely re-types it. If
// they DO change it, onPostcodeChange re-validates catchment / chosen-cleaner
// coverage (unchanged behaviour) and onReselectCleaner offers a way out.

export interface AddressValue {
  line1: string;
  line2: string;
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
  /** Seed the postcode field (free/direct entry). */
  initialPostcode?: string;
  /** The postcode already entered earlier in the flow — pre-fills the field. */
  autoLookupPostcode?: string;
  /** Validate a postcode change. Return accepted=false to surface a message
   *  (e.g. chosen cleaner doesn't cover the area). */
  onPostcodeChange?: (postcode: string) => PostcodeChangeVerdict;
  /** Bounce to cleaner selection for the new postcode (after a coverage reject). */
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
  const [coverageMsg, setCoverageMsg] = useState<string | null>(null);
  const [pendingPc, setPendingPc] = useState('');

  const fieldStyle = { border: '0.5px solid rgba(14,14,12,0.1)' } as const;
  const inputCls =
    'mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20';

  // Seed the postcode field once from the carried-through postcode when empty, so
  // the customer doesn't re-enter what they already gave up front.
  const didSeed = useRef(false);
  useEffect(() => {
    if (didSeed.current) return;
    const seed = (autoLookupPostcode || initialPostcode || '').trim().toUpperCase();
    if (seed && !value.postcode) {
      didSeed.current = true;
      onChange({ ...value, postcode: seed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookupPostcode, initialPostcode]);

  // Re-validate catchment / chosen-cleaner coverage when a full postcode is entered.
  function revalidatePostcode() {
    const pc = value.postcode.trim().toUpperCase();
    setCoverageMsg(null);
    if (onPostcodeChange && isValidPostcode(pc)) {
      const verdict = onPostcodeChange(pc);
      if (!verdict.accepted) {
        setCoverageMsg(verdict.message || "That cleaner doesn't cover this postcode.");
        setPendingPc(pc);
      }
    }
  }

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
          onChange={(e) => {
            onChange({ ...value, postcode: e.target.value.toUpperCase() });
            setCoverageMsg(null);
          }}
          onBlur={revalidatePostcode}
          className={inputCls}
          style={fieldStyle}
        />
      </div>

      {coverageMsg && (
        <div className="space-y-2">
          <p className="font-jost text-xs font-light text-amber-700">{coverageMsg}</p>
          {onReselectCleaner && (
            <button
              type="button"
              onClick={() => onReselectCleaner(pendingPc)}
              className="bg-gold px-4 py-2 font-jost text-xs font-medium text-white transition hover:opacity-90"
            >
              Choose another cleaner
            </button>
          )}
        </div>
      )}
    </div>
  );
}
