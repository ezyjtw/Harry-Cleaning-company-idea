// R9 (Decision 1, James-ruled): the honest five stages of the booking funnel.
// Stages 1–4 are AnalyticsEvent FUNNEL_STEP rows written by useAnalytics
// ('booking') on the ruled booking routes; stage 5 (Paid) is computed from
// Bookings (paymentStatus SUCCEEDED) — no event needed, the money record is
// the truth. Client-safe constants: the instrumented page and the Funnel room
// both import from here so the names can never drift.

export const BOOKING_FUNNEL = 'booking';

export const BOOKING_FUNNEL_STAGES = [
  { step: 1, name: 'flow_entered', label: 'Flow entered' },
  { step: 2, name: 'quote_seen', label: 'Quote seen' },
  { step: 3, name: 'slot_or_cleaner_chosen', label: 'Slot or cleaner chosen' },
  { step: 4, name: 'details_completed', label: 'Details completed / payment started' },
] as const;

export const PAID_STAGE = { step: 5, name: 'paid', label: 'Paid' } as const;
