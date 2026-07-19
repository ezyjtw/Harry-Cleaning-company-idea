// H38: a cleaner who books as a customer must NEVER meet their own purchase
// through the job door. This is the ONE where-fragment every jobs surface
// (portal tabs, app agenda, badges, dashboard) composes in, so the exclusion
// can't fork. NULL clientId (guest bookings) must still pass — a bare
// `clientId: { not: id }` would drop them (SQL NULL semantics).
export function notOwnBookingWhere(userId: string): Record<string, unknown> {
  return { OR: [{ clientId: null }, { clientId: { not: userId } }] };
}
