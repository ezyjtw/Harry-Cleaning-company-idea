// A12 (Stage 4): single place to read a booking's address from the structured
// columns (the source of truth), with a fallback to the legacy `address` relation
// for any pre-A12 rows. Also centralises the A5.5 redaction rule:
//   - redacted (pre-accept / not the assigned cleaner): postcode only
//   - full (post-accept, assigned cleaner): line1, city postcode

export interface BookingAddressSource {
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressPostcode?: string | null;
  // Legacy relation fallback for rows created before A12.
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
}

export function bookingLine1(b: BookingAddressSource): string {
  return (b.addressLine1 || b.address?.line1 || '').trim();
}

export function bookingLine2(b: BookingAddressSource): string {
  return (b.addressLine2 || b.address?.line2 || '').trim();
}

export function bookingCity(b: BookingAddressSource): string {
  return (b.addressCity || b.address?.city || '').trim();
}

export function bookingPostcode(b: BookingAddressSource): string {
  return (b.addressPostcode || b.address?.postcode || '').trim();
}

/** Full address line, e.g. "12 High St, London SW1A 1AA". */
export function bookingFullAddress(b: BookingAddressSource): string {
  const line1 = bookingLine1(b);
  const city = bookingCity(b);
  const postcode = bookingPostcode(b);
  return `${line1}, ${city} ${postcode}`
    .replace(/\s+/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
}

/**
 * A5.5 redaction: `full` (line1 + city + postcode) once the assigned cleaner is
 * post-accept, otherwise just the postcode. `full` callers pass the gate result.
 */
export function bookingDisplayAddress(b: BookingAddressSource, full: boolean): string {
  if (full) return bookingFullAddress(b);
  return bookingPostcode(b) || 'TBD';
}
