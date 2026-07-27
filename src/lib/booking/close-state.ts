/**
 * F16 (James-ruled): a job is terminally CLOSED only when BOTH conditions
 * hold — funds released AND a review left. The two are INDEPENDENT axes:
 * a review NEVER moves money (a negative review leaves funds exactly where
 * the release rules put them), and a release never writes a review. This
 * helper derives the close state from the two truths already on the row —
 * no schema change, no new state machine.
 *
 *   released = transferStatus no longer PENDING (early release, 24h
 *              auto-release, or otherwise settled — any path).
 *   reviewed = status REVIEWED (the reviews route's atomic flip).
 */
export type BookingCloseState =
  | 'open' // completed, funds held, no review yet
  | 'released-awaiting-review'
  | 'reviewed-awaiting-release'
  | 'closed'
  | null; // not in the completion zone at all

export function bookingCloseState(b: {
  status: string;
  transferStatus?: string | null;
}): BookingCloseState {
  if (b.status !== 'COMPLETED' && b.status !== 'REVIEWED') return null;
  const released = b.transferStatus !== 'PENDING';
  const reviewed = b.status === 'REVIEWED';
  if (released && reviewed) return 'closed';
  if (released) return 'released-awaiting-review';
  if (reviewed) return 'reviewed-awaiting-release';
  return 'open';
}
