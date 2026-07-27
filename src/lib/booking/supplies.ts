/**
 * LB-8 (James-corrected): the supplies answer is DERIVED from the +£5
 * products addon — the booking flow asks nothing. One copy source for every
 * cleaner-facing surface — job detail, offer view, offer email, .ics.
 * false = the addon was ticked (the customer paid the products fee, the
 * cleaner brings products); true = no addon (the customer provides);
 * null/undefined = the booking predates the field, so the honest fallback
 * renders instead of a silent blank or a guessed default.
 */
export function suppliesLabel(v: boolean | null | undefined): string {
  if (v === true) return 'Customer provides supplies';
  if (v === false) return 'Bring cleaning products (customer has paid the products fee)';
  return 'Not specified — check with your customer';
}

/** Calendar one-liner for the .ics description — same ruled copy. */
export function suppliesIcsLine(v: boolean | null | undefined): string {
  return suppliesLabel(v);
}
