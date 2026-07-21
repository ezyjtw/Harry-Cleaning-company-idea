// H96 (James-ruled): coverage answers derive from LIVE POLYGON TRUTH — a
// postcode inside ANY live cleaner's polygon is covered; outside all of them
// gets the honest not-yet/waitlist state. This client helper asks
// /api/cleaners (the search endpoint whose filter IS cleanerCoversPoint —
// polygon-first, crow-flies fallback, eligibleCleanerWhere gate), so the
// hero/quote entry can never disagree with who search says serves an area.
// It replaced src/lib/catchment.ts, a hardcoded postcode-prefix allowlist
// that waitlisted postcodes (N17…) sitting INSIDE real isochrones.
//
// Fail direction: `covered: null` means "could not evaluate" (network error,
// non-OK response). Callers treat null as covered-enough-to-proceed — the
// same fail-open ruling as the booking-flow /covers check; the cascade only
// ever offers to genuinely-covering cleaners, so the risk is bounded.
// Geocode outages fail open inside the API itself (no geo → no filter).
export async function anyLiveCleanerCovers(
  postcode: string
): Promise<{ covered: boolean | null; count: number | null }> {
  try {
    const res = await fetch(`/api/cleaners?postcode=${encodeURIComponent(postcode)}&limit=1`);
    if (!res.ok) return { covered: null, count: null };
    const d = await res.json();
    const count = typeof d?.count === 'number' ? d.count : null;
    return { covered: count === null ? null : count > 0, count };
  } catch {
    return { covered: null, count: null };
  }
}
