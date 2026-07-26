/**
 * LB-7 (James-ruled): one copy source for the supplies answer on every
 * surface — job detail, offer view, offer email, .ics. true = the customer
 * provides supplies and equipment; false = the cleaner brings their own;
 * null/undefined = the booking predates the question, so the honest
 * fallback renders instead of a silent blank or a guessed default.
 */
export function suppliesLabel(v: boolean | null | undefined): string {
  if (v === true) return 'Supplies provided by the customer';
  if (v === false) return 'Bring your own supplies';
  return 'Not specified — check with your customer';
}

/** Short calendar one-liner for the .ics description. */
export function suppliesIcsLine(v: boolean | null | undefined): string {
  if (v === true) return 'Supplies provided';
  if (v === false) return 'Bring supplies';
  return 'Supplies: not specified — check with your customer';
}
