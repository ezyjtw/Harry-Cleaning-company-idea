// B3 gate (James-ruled): the recognised cleaner-lock wait timeout answers
// 503 { error: 'BUSY', message } with Retry-After, and ONLY that condition.
// Every other error passes through untouched (a database failure is never
// dressed as busy).

import { NextResponse } from 'next/server';

import { CleanerBusyError } from '@/lib/booking/assign';

export const BUSY_RETRY_AFTER_SECONDS = 5;
export const BUSY_MESSAGE = 'This is busy right now. Please try again in a few seconds.';

export function busyResponse(err: unknown): NextResponse | null {
  if (!(err instanceof CleanerBusyError)) return null;
  return NextResponse.json(
    { error: 'BUSY', message: BUSY_MESSAGE },
    { status: 503, headers: { 'Retry-After': String(BUSY_RETRY_AFTER_SECONDS) } }
  );
}

/** Wrap a route handler so a CleanerBusyError becomes the 503; all else rethrows. */
export function mapBusy<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      const busy = busyResponse(err);
      if (busy) return busy;
      throw err;
    }
  };
}
