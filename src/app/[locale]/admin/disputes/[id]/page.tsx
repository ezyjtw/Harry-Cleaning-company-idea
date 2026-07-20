import { notFound } from 'next/navigation';

import prisma from '@/lib/db/prisma';
import { displayName } from '@/lib/utils/name';

import DisputeDetail from './DisputeDetail';

export const dynamic = 'force-dynamic';

// Admin dispute detail (James, from live testing): the "Review" button now opens
// THE FULL CASE — claim, both parties' evidence, booking + money context, the
// message thread, a timeline, and the money-aware resolution actions — instead
// of just stamping the status. Opening the case is where UNDER_REVIEW is set
// (side-effect below), not the whole feature.
export default async function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  // The list links with the full dispute id; tolerate a truncated prefix too.
  const dispute = await prisma.dispute.findFirst({
    where: { OR: [{ id: params.id }, { id: { startsWith: params.id.toLowerCase() } }] },
    include: {
      raisedBy: { select: { id: true, name: true, role: true } },
      evidence: { orderBy: { uploadedAt: 'asc' } },
      booking: {
        include: {
          client: { select: { id: true, name: true, email: true } },
          cleaner: { select: { id: true, name: true, email: true } },
          refundRecords: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
        },
      },
    },
  });
  if (!dispute) notFound();

  // Side-effect of OPENING the case: OPEN → UNDER_REVIEW (the stamp is a
  // consequence of investigating, per the ruling). Never touches a resolved one.
  if (dispute.status === 'OPEN') {
    await prisma.dispute
      .update({ where: { id: dispute.id }, data: { status: 'UNDER_REVIEW' } })
      .catch(() => {});
    dispute.status = 'UNDER_REVIEW';
  }

  const b = dispute.booking;

  // Message thread between the two parties on this booking (dispute context).
  const messages =
    b.clientId && b.cleanerId
      ? await prisma.message.findMany({
          where: { bookingId: b.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true, senderId: true, content: true, createdAt: true },
        })
      : [];

  // Timeline: dispute + evidence + audit rows that touch this dispute/booking.
  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Dispute', entityId: dispute.id },
        { entityType: 'DisputeEvidence', entityId: { in: dispute.evidence.map((e) => e.id) } },
        { entityType: 'Booking', entityId: b.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, createdAt: true, metadata: true },
  });

  const refundedSoFar = b.refundRecords.reduce((s, r) => s + Number(r.amount), 0);
  const charged = Number(b.totalAmountCharged ?? b.totalPrice);

  // H69: a null actor is the booking's GUEST customer (token-authorised).
  const partyOf = (userId: string | null): 'customer' | 'cleaner' | 'Rena team' =>
    userId === null || userId === b.clientId
      ? 'customer'
      : userId === b.cleanerId
        ? 'cleaner'
        : 'Rena team';

  const data = {
    id: dispute.id,
    shortId: dispute.id.substring(0, 8).toUpperCase(),
    status: dispute.status,
    reason: dispute.reason,
    description: dispute.description,
    resolution: dispute.resolution,
    createdAt: dispute.createdAt.toISOString(),
    filedBy: dispute.raisedBy?.role === 'CLEANER' ? 'cleaner' : 'customer',
    booking: {
      id: b.id,
      shortId: b.id.substring(0, 8).toUpperCase(),
      status: b.status,
      transferStatus: b.transferStatus,
      paymentStatus: b.paymentStatus,
      serviceType: b.serviceType,
      date: b.date.toISOString().split('T')[0],
      time: b.startTime,
      charged,
      cleanerEarnings: Number(b.cleanerEarnings),
      refundedSoFar,
      remainder: Math.max(0, charged - refundedSoFar),
      customer: {
        name: displayName(b.client?.name) || b.guestName || 'Guest',
        email: b.client?.email || b.guestEmail || '',
      },
      cleaner: {
        name: displayName(b.cleaner?.name) || 'Unassigned',
        email: b.cleaner?.email || '',
      },
    },
    evidence: dispute.evidence.map((ev) => ({
      id: ev.id,
      type: ev.type,
      fileName: ev.fileName,
      description: ev.description,
      uploadedBy: partyOf(ev.uploadedBy),
      uploadedAt: ev.uploadedAt.toISOString(),
      viewUrl: `/api/disputes/${dispute.id}/evidence/${ev.id}`,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      party: partyOf(m.senderId),
      content: m.content,
      at: m.createdAt.toISOString(),
    })),
    timeline: [
      { id: `filed-${dispute.id}`, label: 'Dispute filed', at: dispute.createdAt.toISOString() },
      ...dispute.evidence.map((e) => ({
        id: `ev-${e.id}`,
        label: `Evidence added (${partyOf(e.uploadedBy)})`,
        at: e.uploadedAt.toISOString(),
      })),
      ...audit.map((a) => ({
        id: a.id,
        label: a.action.replace(/_/g, ' ').toLowerCase(),
        at: a.createdAt.toISOString(),
      })),
    ].sort((x, y) => x.at.localeCompare(y.at)),
  };

  return <DisputeDetail data={data} />;
}
