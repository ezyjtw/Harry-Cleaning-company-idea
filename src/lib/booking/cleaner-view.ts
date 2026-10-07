// B3.3 (RENA-026, James-ruled): the ONE gate for what a cleaner sees of a job
// before they are assigned it.
//
// assigned = booking.cleanerId === viewer && status not in
// {PENDING, AWAITING_CLEANER, CASCADE_EXHAUSTED}, and a CANCELLED row only when
// the viewer had accepted it (acceptedAt set): a customer cancel before the
// primary accepted leaves cleanerId pinned to someone who never took the job.
// An admin-placed CONFIRMED job cancelled before the cleaner's accept reads as
// unassigned too; nothing remains to do on it. An assigned row keeps each
// route's existing full payload. Before that, the payload is EXACTLY the
// PRE_ACCEPT_KEYS below — no other key is present, not even as undefined:
// first name, outward postcode plus town, service, date and time, duration,
// property characteristics, structured extras, supplies and the viewer's own
// earnings. Never the email, surname, phone, street, address lines, notes,
// cleaner notes, key access, admin notes, or the payment status.
//
// context is documented: { travelMinutes: number | null, sameDayJobs:
// number | null } — the viewer's own travel estimate and their other active
// jobs that day; null where the route does not compute it.

import type { Booking } from '@prisma/client';

import { getTransferAmountPence } from '@/lib/services/transfer-amount';

export const PRE_ACCEPT_KEYS = [
  'id',
  'status',
  'cascadePhase',
  'cascadeExpiresAt',
  'isPrimary',
  'isBackup',
  'isReserve',
  'isProvisional',
  'date',
  'time',
  'duration',
  'serviceType',
  'recurringFrequency',
  'customerFirstName',
  'postcode',
  'city',
  'bedrooms',
  'propertySize',
  'extras',
  'suppliesProvided',
  'cleanerEarnings',
  'earningsBreakdown',
  'hasBackups',
  'context',
] as const;

export type PreAcceptKey = (typeof PRE_ACCEPT_KEYS)[number];

export interface OfferContext {
  travelMinutes: number | null;
  sameDayJobs: number | null;
}

export interface EarningsBreakdown {
  rate: number;
  feePct: number;
  fee: number;
  productsNet: number;
  receive: number;
}

type ViewableBooking = Pick<
  Booking,
  | 'id'
  | 'status'
  | 'cleanerId'
  | 'cascadePhase'
  | 'cascadeExpiresAt'
  | 'backupCleanerIds'
  | 'reserveCleanerIds'
  | 'date'
  | 'startTime'
  | 'duration'
  | 'serviceType'
  | 'propertySize'
  | 'extras'
  | 'suppliesProvided'
  | 'cleanerEarnings'
  | 'rooms'
  | 'guestName'
  | 'addressPostcode'
  | 'addressCity'
> & {
  provisionalCleanerId?: string | null;
  client?: { name: string | null } | null;
  address?: { postcode?: string | null; city?: string | null } | null;
  agreement?: { frequency: string } | null;
};

/** The assignment test the serializer and every route share. */
export function isAssignedTo(
  booking: Pick<Booking, 'cleanerId' | 'status' | 'acceptedAt'>,
  viewerId: string
): boolean {
  return (
    booking.cleanerId === viewerId &&
    booking.status !== 'PENDING' &&
    booking.status !== 'AWAITING_CLEANER' &&
    booking.status !== 'CASCADE_EXHAUSTED' &&
    !(booking.status === 'CANCELLED' && !booking.acceptedAt)
  );
}

/** "E4 7AA" → "E4"; "SW1A1AA" → "SW1A". Null for anything that is not a postcode. */
export function outwardCode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const compact = postcode.replace(/\s+/g, '').toUpperCase();
  if (compact.length < 5 || compact.length > 7) return null;
  return compact.slice(0, compact.length - 3);
}

/** The first whitespace token of the customer's name (never the surname). */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}

export function serializePreAccept(
  booking: ViewableBooking,
  viewerId: string,
  ctx: {
    /** The viewer's own figure: their quote for backups and reserves. */
    viewerEarnings?: number | null;
    viewerBreakdown?: EarningsBreakdown | null;
    storedBreakdown?: EarningsBreakdown | null;
    context?: OfferContext;
    /** The list route speaks lowercase statuses; the detail route does not. */
    lowercaseStatus?: boolean;
  }
): Record<PreAcceptKey, unknown> {
  const isPrimary = booking.cleanerId === viewerId;
  const isProvisional =
    booking.cascadePhase === 'PROVISIONAL_APPROVAL' && booking.provisionalCleanerId === viewerId;
  const isReserve = (booking.reserveCleanerIds ?? []).includes(viewerId);
  const isBackup = (booking.backupCleanerIds ?? []).includes(viewerId);
  const viewerOwn = !isPrimary && ctx.viewerEarnings !== null && ctx.viewerEarnings !== undefined;
  const rooms = (booking.rooms ?? {}) as Record<string, unknown>;

  const view: Record<PreAcceptKey, unknown> = {
    id: booking.id,
    status: ctx.lowercaseStatus ? booking.status.toLowerCase() : booking.status,
    cascadePhase: booking.cascadePhase,
    cascadeExpiresAt: booking.cascadeExpiresAt ? booking.cascadeExpiresAt.toISOString() : null,
    isPrimary,
    isBackup,
    isReserve,
    isProvisional,
    date: booking.date.toISOString().split('T')[0],
    time: booking.startTime,
    duration: Number(booking.duration),
    serviceType: booking.serviceType,
    recurringFrequency: booking.agreement?.frequency ?? null,
    customerFirstName: firstNameOf(booking.client?.name ?? booking.guestName) ?? 'Customer',
    postcode: outwardCode(booking.addressPostcode ?? booking.address?.postcode ?? null),
    city: booking.addressCity ?? booking.address?.city ?? null,
    bedrooms: typeof rooms.bedrooms === 'number' ? rooms.bedrooms : null,
    propertySize: booking.propertySize ?? null,
    extras: booking.extras ?? [],
    suppliesProvided: booking.suppliesProvided ?? null,
    // H104 money law: the stored figure is THE payout function's figure.
    cleanerEarnings: viewerOwn
      ? ctx.viewerEarnings
      : getTransferAmountPence(Number(booking.cleanerEarnings)) / 100,
    earningsBreakdown: viewerOwn ? (ctx.viewerBreakdown ?? null) : (ctx.storedBreakdown ?? null),
    hasBackups: (booking.backupCleanerIds ?? []).length > 0,
    context: ctx.context ?? { travelMinutes: null, sameDayJobs: null },
  };
  return view;
}
