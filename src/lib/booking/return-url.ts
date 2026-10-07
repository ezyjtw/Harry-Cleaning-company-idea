// RENA-020 (B2a): the Stripe return_url for a booking payment. It carries the
// guest token whenever the server minted one, independent of the mode the
// client believed it was in: the server decides guest-ness by session, so an
// account-mode checkout whose session lapsed before submit is booked as a
// guest, and without the token the confirmation page would 401 into a dead
// end. Pure, so the encoding is unit tested.
export function buildReturnUrl(
  appUrl: string,
  bookingId: string,
  guestToken: string | null | undefined
): string {
  const base = `${appUrl.replace(/\/+$/, '')}/en/booking-confirmation/${encodeURIComponent(bookingId)}`;
  return guestToken ? `${base}?gt=${encodeURIComponent(guestToken)}` : base;
}
