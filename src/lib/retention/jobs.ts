// B7.3 (RENA-063): the retention jobs, one per matrix row, each
// runRetentionJob(row, { now, batch }): select rows past the horizon and not
// held, apply the row's action in batches of BATCH_SIZE inside one
// transaction per batch, write one DataRetentionLog row per batch with counts
// only, and select nothing on a re-run (idempotent by construction: every
// selection excludes rows already acted on). Audit delete runs last and never
// touches a row younger than its horizon, COMPLIANCE_JOB_RUN included.
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';

import {
  BATCH_SIZE,
  CHARGEBACK_WINDOW_DAYS,
  DAY_MS,
  MESSAGE_REDACTED,
  type RetentionClass,
  horizonCutoff,
  matrixRow,
} from './matrix';

export interface RetentionRunOptions {
  now?: Date;
  batch?: number;
  /** Safety valve for a first production run: stop after this many batches. */
  maxBatches?: number;
}

export interface RetentionRunResult {
  class: RetentionClass;
  cutoff: string;
  batches: number;
  affected: number;
  /** Rows past the horizon that a legal hold kept, counted once per run. */
  held: number;
}

const OPEN_DISPUTE = ['OPEN', 'UNDER_REVIEW', 'RESOLVING_REFUND', 'RESOLVING_RELEASE'] as const;
const SETTLED_TRANSFER = ['RELEASED', 'REFUNDED'] as const;
const PAID = ['SUCCEEDED', 'PARTIALLY_REFUNDED'] as const;

async function logBatch(
  tx: Prisma.TransactionClient,
  cls: RetentionClass,
  affected: number,
  cutoff: Date,
  extra: Record<string, number> = {}
) {
  await tx.dataRetentionLog.create({
    data: {
      entityType: cls,
      entityId: 'batch',
      action: matrixRow(cls).action.toUpperCase(),
      reason: 'retention_policy',
      performedBy: 'SYSTEM',
      metadata: { affected, cutoff: cutoff.toISOString(), ...extra },
    },
  });
}

type Selector = (cutoff: Date, take: number) => Promise<string[]>;
type Applier = (tx: Prisma.TransactionClient, ids: string[], cutoff: Date) => Promise<number>;

async function runBatches(
  cls: RetentionClass,
  opts: RetentionRunOptions,
  select: Selector,
  apply: Applier,
  countHeld: (cutoff: Date) => Promise<number>
): Promise<RetentionRunResult> {
  const now = opts.now ?? new Date();
  const take = opts.batch ?? BATCH_SIZE;
  const cutoff = horizonCutoff(cls, now);
  let batches = 0;
  let affected = 0;
  // Each batch selects afresh: an applied row no longer matches, so the loop
  // ends when the selection is empty. A row that still matches after apply
  // would loop forever; maxBatches is the guard against such a bug.
  while (batches < (opts.maxBatches ?? 1000)) {
    const ids = await select(cutoff, take);
    if (ids.length === 0) break;
    const n = await prisma.$transaction(async (tx) => {
      const count = await apply(tx, ids, cutoff);
      await logBatch(tx, cls, count, cutoff);
      return count;
    });
    batches += 1;
    affected += n;
    if (n === 0) {
      log.error('retention', 'batch_applied_nothing', { class: cls, selected: ids.length });
      break;
    }
    if (ids.length < take) break;
  }
  const held = await countHeld(cutoff);
  log.info('retention', 'job_run', { class: cls, batches, affected, held });
  return { class: cls, cutoff: cutoff.toISOString(), batches, affected, held };
}

// ─── Account data: six years after closure, tombstone to the minimum ────────

function accountHoldWhere(now: Date): Prisma.UserWhereInput {
  const taxCutoff = horizonCutoff('bookingRecords', now);
  const bookingHold = (b: Prisma.BookingWhereInput): Prisma.UserWhereInput => ({
    OR: [{ bookingsAsClient: { some: b } }, { bookingsAsCleaner: { some: b } }],
  });
  return {
    OR: [
      bookingHold({ dispute: { is: { status: { in: [...OPEN_DISPUTE] } } } }),
      bookingHold({ complaints: { some: { status: { in: [...OPEN_DISPUTE] } } } }),
      bookingHold({
        paymentStatus: { in: [...PAID] },
        transferStatus: { notIn: [...SETTLED_TRANSFER] },
      }),
      bookingHold({ date: { gte: taxCutoff } }),
    ],
  };
}

function accountPastHorizon(cutoff: Date): Prisma.UserWhereInput {
  return {
    retentionTombstonedAt: null,
    OR: [
      { isDeleted: true, deletedAt: { lt: cutoff } },
      { accountStatus: 'DEACTIVATED', updatedAt: { lt: cutoff } },
    ],
  };
}

export function runAccountDataRetention(opts: RetentionRunOptions = {}) {
  const now = opts.now ?? new Date();
  return runBatches(
    'accountData',
    opts,
    async (cutoff, take) =>
      (
        await prisma.user.findMany({
          where: { AND: [accountPastHorizon(cutoff), { NOT: accountHoldWhere(now) }] },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map((u) => u.id),
    async (tx, ids) => {
      let n = 0;
      for (const id of ids) {
        await tx.address.deleteMany({ where: { userId: id } });
        await tx.cleanerProfile.updateMany({
          where: { userId: id },
          data: { bio: null, homePostcode: null },
        });
        const r = await tx.user.updateMany({
          where: { id, retentionTombstonedAt: null },
          data: {
            name: 'Deleted user',
            email: `deleted+${id}@invalid`,
            phone: null,
            image: null,
            passwordHash: null,
            retentionTombstonedAt: now,
          },
        });
        n += r.count;
      }
      return n;
    },
    (cutoff) =>
      prisma.user.count({ where: { AND: [accountPastHorizon(cutoff), accountHoldWhere(now)] } })
  );
}

// ─── Booking records: six years after the booking date, anonymise, never delete

function bookingPii(): Prisma.BookingWhereInput {
  return {
    OR: [
      { guestName: { not: null } },
      { guestEmail: { not: null } },
      { guestPhone: { not: null } },
      { guestToken: { not: null } },
      { addressLine1: { not: null } },
      { addressLine2: { not: null } },
      { notes: { not: null } },
      { cleanerNotes: { not: null } },
      { adminNotes: { not: null } },
    ],
  };
}

function bookingHoldWhere(now: Date): Prisma.BookingWhereInput {
  const chargebackSince = new Date(now.getTime() - CHARGEBACK_WINDOW_DAYS * DAY_MS);
  return {
    OR: [
      { dispute: { is: { status: { in: [...OPEN_DISPUTE] } } } },
      { complaints: { some: { status: { in: [...OPEN_DISPUTE] } } } },
      { dispute: { is: { createdAt: { gte: chargebackSince } } } },
    ],
  };
}

/** rooms is free JSON; string values could carry access notes, so only numbers and booleans survive. */
export function stripRoomsText(rooms: unknown): Prisma.InputJsonValue | undefined {
  if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) return undefined;
  const out: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(rooms as Record<string, unknown>)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function runBookingRecordsRetention(opts: RetentionRunOptions = {}) {
  const now = opts.now ?? new Date();
  return runBatches(
    'bookingRecords',
    opts,
    async (cutoff, take) =>
      (
        await prisma.booking.findMany({
          where: { date: { lt: cutoff }, AND: [bookingPii(), { NOT: bookingHoldWhere(now) }] },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map((b) => b.id),
    async (tx, ids) => {
      const rows = await tx.booking.findMany({
        where: { id: { in: ids } },
        select: { id: true, rooms: true },
      });
      let n = 0;
      for (const b of rows) {
        const r = await tx.booking.updateMany({
          where: { id: b.id },
          data: {
            guestName: null,
            guestEmail: null,
            guestPhone: null,
            guestToken: null,
            addressLine1: null,
            addressLine2: null,
            notes: null,
            cleanerNotes: null,
            adminNotes: null,
            ...(b.rooms ? { rooms: stripRoomsText(b.rooms) } : {}),
          },
        });
        n += r.count;
      }
      return n;
    },
    (cutoff) =>
      prisma.booking.count({
        where: { date: { lt: cutoff }, AND: [bookingPii(), bookingHoldWhere(now)] },
      })
  );
}

// ─── Messages: two years after the thread's last message, redact per thread ─

// The anchor is per thread (sender and receiver pair plus booking): a thread
// with one new message keeps every message, so a live conversation is never
// partially redacted. Set-based in SQL, since the anchor is an aggregate.
async function selectRedactableMessages(cutoff: Date, take: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m."id"
    FROM "Message" m
    WHERE m."content" <> ${MESSAGE_REDACTED}
      AND NOT EXISTS (
        SELECT 1 FROM "Dispute" d
        WHERE d."bookingId" = m."bookingId" AND d."status"::text IN ('OPEN','UNDER_REVIEW','RESOLVING_REFUND','RESOLVING_RELEASE')
      )
      AND (
        SELECT MAX(t."createdAt") FROM "Message" t
        WHERE t."bookingId" = m."bookingId"
          AND LEAST(t."senderId", t."receiverId") = LEAST(m."senderId", m."receiverId")
          AND GREATEST(t."senderId", t."receiverId") = GREATEST(m."senderId", m."receiverId")
      ) < ${cutoff}
    ORDER BY m."id" ASC
    LIMIT ${take}`;
  return rows.map((r) => r.id);
}

export function runMessagesRetention(opts: RetentionRunOptions = {}) {
  return runBatches(
    'messages',
    opts,
    selectRedactableMessages,
    async (tx, ids) => {
      await tx.messageReport.deleteMany({ where: { messageId: { in: ids } } });
      const r = await tx.message.updateMany({
        where: { id: { in: ids }, content: { not: MESSAGE_REDACTED } },
        data: { content: MESSAGE_REDACTED },
      });
      return r.count;
    },
    async (cutoff) => {
      const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n FROM "Message" m
        WHERE m."content" <> ${MESSAGE_REDACTED}
          AND EXISTS (
            SELECT 1 FROM "Dispute" d
            WHERE d."bookingId" = m."bookingId" AND d."status"::text IN ('OPEN','UNDER_REVIEW','RESOLVING_REFUND','RESOLVING_RELEASE')
          )
          AND (
            SELECT MAX(t."createdAt") FROM "Message" t
            WHERE t."bookingId" = m."bookingId"
              AND LEAST(t."senderId", t."receiverId") = LEAST(m."senderId", m."receiverId")
              AND GREATEST(t."senderId", t."receiverId") = GREATEST(m."senderId", m."receiverId")
          ) < ${cutoff}`;
      return Number(rows[0]?.n ?? 0);
    }
  );
}

// ─── Notifications: two years, delete ───────────────────────────────────────

export function runNotificationsRetention(opts: RetentionRunOptions = {}) {
  return runBatches(
    'notifications',
    opts,
    async (cutoff, take) =>
      (
        await prisma.notification.findMany({
          where: { createdAt: { lt: cutoff } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map((n) => n.id),
    async (tx, ids) => (await tx.notification.deleteMany({ where: { id: { in: ids } } })).count,
    async () => 0
  );
}

// ─── Consent metadata: two years, null IP and user agent, keep the decision ─

export function runConsentMetadataRetention(opts: RetentionRunOptions = {}) {
  return runBatches(
    'consentMetadata',
    opts,
    async (cutoff, take) =>
      (
        await prisma.gdprConsent.findMany({
          where: {
            createdAt: { lt: cutoff },
            OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }],
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map((c) => c.id),
    async (tx, ids) =>
      (
        await tx.gdprConsent.updateMany({
          where: { id: { in: ids } },
          data: { ipAddress: null, userAgent: null },
        })
      ).count,
    async () => 0
  );
}

// ─── Audit logs: seven years, delete; runs last ─────────────────────────────

export function runAuditLogsRetention(opts: RetentionRunOptions = {}) {
  return runBatches(
    'auditLogs',
    opts,
    async (cutoff, take) =>
      (
        await prisma.auditLog.findMany({
          where: { createdAt: { lt: cutoff } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map((a) => a.id),
    async (tx, ids, cutoff) =>
      // The cutoff is re-applied inside the transaction, so a row younger than
      // seven years (COMPLIANCE_JOB_RUN included) can never be deleted.
      (await tx.auditLog.deleteMany({ where: { id: { in: ids }, createdAt: { lt: cutoff } } }))
        .count,
    async () => 0
  );
}

/** The matrix order; audit last. */
export const RETENTION_JOBS = [
  { job: 'retention_account_data', run: runAccountDataRetention },
  { job: 'retention_booking_records', run: runBookingRecordsRetention },
  { job: 'retention_messages', run: runMessagesRetention },
  { job: 'retention_notifications', run: runNotificationsRetention },
  { job: 'retention_consent_metadata', run: runConsentMetadataRetention },
  { job: 'retention_audit_logs', run: runAuditLogsRetention },
] as const;
