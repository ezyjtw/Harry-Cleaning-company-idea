// H38: a cleaner who books as a customer must NEVER meet their own purchase
// through the job door. This is the ONE where-fragment every jobs surface
// (portal tabs, app agenda, badges, dashboard) composes in, so the exclusion
// can't fork. NULL clientId (guest bookings) must still pass — a bare
// `clientId: { not: id }` would drop them (SQL NULL semantics).
export function notOwnBookingWhere(userId: string): Record<string, unknown> {
  return { OR: [{ clientId: null }, { clientId: { not: userId } }] };
}

// H53 law — NO PAYMENT → NO OFFER, EVER. The cascade only ever goes live on the
// payment-success webhook, so any booking a cleaner should see is already paid.
// But a freshly-created cleaner-first booking sits `cascadePhase: null` + status
// PENDING while the customer is still on the card step — and the jobs query's
// null-cascade branch would otherwise show it. This read-guard makes the law
// defensive: a cleaner NEVER sees an unpaid booking, so an abandoned checkout
// can't phantom-offer, and any legacy unpaid-but-live row vanishes on deploy
// without waiting for the reaper. Post-payment states (SUCCEEDED, and the
// refunded states a completed job may reach) still pass.
const UNPAID_PAYMENT_STATUSES = ['PENDING', 'FAILED', 'CANCELED', 'REQUIRES_ACTION'] as const;

export function paidVisibleWhere(): Record<string, unknown> {
  return { paymentStatus: { notIn: [...UNPAID_PAYMENT_STATUSES] } };
}
