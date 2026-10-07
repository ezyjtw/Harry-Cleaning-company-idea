// B3 gate (James-ruled): the break-glass override's one lifecycle stamp. A
// Flexible booking's completion window anchors on checkedInAt, so an override
// INTO IN_PROGRESS stamps it when absent; without it the cleaner could never
// leave IN_PROGRESS (COMPLETED would answer NEEDS_START for ever).

import { isFlexibleStart } from '@/lib/time/booking-time';

export function needsCheckInStamp(
  booking: { startTime: string | null; checkedInAt: Date | null },
  target: string
): boolean {
  return target === 'IN_PROGRESS' && isFlexibleStart(booking.startTime) && !booking.checkedInAt;
}
