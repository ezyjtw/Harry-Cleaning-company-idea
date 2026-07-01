import { BankTransaction, LineAmountTypes } from 'xero-node';
import type { Contact, LineItem, XeroClient } from 'xero-node';

import { prisma } from '@/lib/db/prisma';
import { JobQueueService } from '@/lib/services/job-queue.service';
import { getTransferAmountPence } from '@/lib/services/transfer-amount';
import {
  cachePlatformContactId,
  getAuthedClient,
  getConnection,
  getMapping,
  isPushEnabled,
  type XeroMapping,
} from '@/lib/services/xero.service';

// A13-Xero-c: push bank transactions into James's Xero org (the FIRST code that
// writes to Xero). Every push is gated by isPushEnabled() (connected + required
// mapping complete + flag ON) at BOTH enqueue and run time, idempotent via
// XeroPushLog + Xero's Idempotency-Key header, and posts to the mapped BANK
// account. TaxType is NONE throughout (James is unregistered).
//
// REAL-MONEY anchoring (per the field-set ruling): lines reflect what actually
// happened to the money so Xero reconciles with the Stripe balance —
//   gross RECEIVE      = totalAmountCharged (the actual charge)
//   clearing line      = getTransferAmountPence(cleanerEarnings) (the actual transfer)
//   commission + fee   = (gross − clearing), split ONLY by the snapshot ratio
//                        platformCommissionAmount : customerServiceFee
//   payout SPEND       = getTransferAmountPence(cleanerEarnings)
// The snapshot fields are used solely to divide the commission-vs-fee remainder.

export type XeroPushEvent = 'PAYMENT_RECEIVED' | 'PAYOUT' | 'REFUND';

export interface XeroPushPayload {
  bookingId: string;
  event: XeroPushEvent;
  externalRef?: string; // stripeRefundId for REFUND; "" otherwise
  occurredAt?: string; // ISO — the Stripe event time → transaction date
  // REFUND only. Captured at ENQUEUE time (pre-mutation) because A5.2 reduces
  // cleanerEarnings on a pre-release refund, so re-reading it at run time would
  // be wrong for multi-partial refunds.
  isPostRelease?: boolean;
  refundAmount?: number; // £ — RefundRecord.amount
  cleanerRefundPortion?: number; // £ — cleaner's proportional share of this refund
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Enqueue a XERO_PUSH job — but only when pushing is actually enabled, so a
 * disabled integration queues nothing at all (zero footprint).
 */
export async function enqueueXeroPush(payload: XeroPushPayload): Promise<void> {
  if (!(await isPushEnabled())) return;
  await JobQueueService.enqueue('XERO_PUSH', payload as unknown as Record<string, unknown>);
}

/** Job handler: build + post the bank transaction(s) for one booking event. */
export async function processXeroPush(payload: XeroPushPayload): Promise<void> {
  const { bookingId, event } = payload;
  const externalRef = payload.externalRef ?? '';

  // Runtime re-check: the flag may have flipped off between enqueue and drain.
  if (!(await isPushEnabled())) return;

  const mapping = await getMapping();
  if (!mapping) return;
  // Bank is OPTIONAL to save but REQUIRED to push — transactions post to it.
  if (!mapping.bankAccountCode) {
    // eslint-disable-next-line no-console
    console.warn(`[xero-push] bank account unmapped — skipping ${event} for ${bookingId}`);
    return;
  }

  // Idempotency: a COMPLETED row means this exact (booking,event,ref) already posted.
  const existing = await prisma.xeroPushLog.findUnique({
    where: { bookingId_event_externalRef: { bookingId, event, externalRef } },
  });
  if (existing?.status === 'COMPLETED') return;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  // Claim (or reuse) a PENDING log row.
  const log =
    existing ??
    (await prisma.xeroPushLog.create({
      data: { bookingId, event, externalRef, status: 'PENDING' },
    }));

  try {
    const authed = await getAuthedClient();
    if (!authed) throw new Error('Xero not connected at push time');

    const contactID = await findOrCreatePlatformContact(authed);
    const txns = buildBankTransactions(event, booking, mapping, contactID, payload);
    if (txns.length === 0) {
      // Nothing to post (e.g. every line rounded to zero) — mark done, don't retry.
      await prisma.xeroPushLog.update({
        where: { id: log.id },
        data: { status: 'COMPLETED', lastError: null },
      });
      return;
    }

    // Idempotency-Key: Xero itself de-dupes a retry that races before our log write.
    const idempotencyKey = `${bookingId}:${event}:${externalRef}`;
    const res = await authed.client.accountingApi.createBankTransactions(
      authed.tenantId,
      { bankTransactions: txns },
      true, // summarizeErrors → validation failures throw so the worker retries
      undefined, // unitdp
      idempotencyKey
    );

    const ids = (res.body.bankTransactions ?? [])
      .map((t) => t.bankTransactionID)
      .filter(Boolean)
      .join(',');
    await prisma.xeroPushLog.update({
      where: { id: log.id },
      data: { status: 'COMPLETED', xeroId: ids || null, lastError: null },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await prisma.xeroPushLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', lastError: msg },
    });
    throw err; // surface to the job processor for retry/backoff
  }
}

/** Find-or-create the single "Rena Marketplace" contact and cache its id. */
async function findOrCreatePlatformContact(authed: {
  client: XeroClient;
  tenantId: string;
}): Promise<string> {
  const conn = await getConnection();
  if (conn?.platformContactId) return conn.platformContactId;

  const name = 'Rena Marketplace';
  const found = await authed.client.accountingApi.getContacts(
    authed.tenantId,
    undefined,
    `Name=="${name}"`
  );
  let contactID = found.body.contacts?.[0]?.contactID;

  if (!contactID) {
    const created = await authed.client.accountingApi.createContacts(authed.tenantId, {
      contacts: [{ name }],
    });
    contactID = created.body.contacts?.[0]?.contactID;
  }
  if (!contactID) throw new Error('Could not resolve the Rena Marketplace Xero contact');

  await cachePlatformContactId(contactID);
  return contactID;
}

/** Build the 1–2 bank transactions for an event. Lines reconcile to the gross. */
function buildBankTransactions(
  event: XeroPushEvent,
  booking: {
    id: string;
    totalPrice: unknown;
    totalAmountCharged: unknown;
    cleanerEarnings: unknown;
    platformCommissionAmount: unknown;
    customerServiceFee: unknown;
  },
  mapping: XeroMapping,
  contactID: string,
  payload: XeroPushPayload
): BankTransaction[] {
  const contact: Contact = { contactID };
  const bankAccount = { accountID: mapping.bankAccountCode as string };
  const date = (payload.occurredAt ? new Date(payload.occurredAt) : new Date())
    .toISOString()
    .slice(0, 10);

  const line = (amount: number, accountCode: string | null, description: string): LineItem => ({
    description,
    quantity: 1,
    unitAmount: money(amount),
    accountCode: accountCode ?? undefined,
    taxType: 'NONE',
  });
  const nonZero = (items: LineItem[]) => items.filter((li) => (li.unitAmount ?? 0) > 0);

  // Snapshot ratio ONLY splits commission-vs-fee within a remainder.
  const commissionSnap = Number(booking.platformCommissionAmount ?? 0);
  const feeSnap = Number(booking.customerServiceFee ?? 0);
  const ratioBase = commissionSnap + feeSnap;
  const splitRemainder = (remainder: number) => {
    const r = money(remainder);
    const commission = ratioBase > 0 ? money(r * (commissionSnap / ratioBase)) : r;
    const fee = money(r - commission); // remainder − commission → exact, no drift
    return { commission, fee };
  };

  const cleanerNet = money(getTransferAmountPence(Number(booking.cleanerEarnings)) / 100);

  if (event === 'PAYMENT_RECEIVED') {
    const gross = money(Number(booking.totalAmountCharged ?? booking.totalPrice));
    const { commission, fee } = splitRemainder(gross - cleanerNet);
    const lineItems = nonZero([
      line(commission, mapping.commissionAccountCode, 'Rena commission'),
      line(fee, mapping.feeAccountCode, 'Platform service fee'),
      line(cleanerNet, mapping.clearingAccountCode, 'Cleaner net (held on their behalf)'),
    ]);
    return lineItems.length === 0
      ? []
      : [
          {
            type: BankTransaction.TypeEnum.RECEIVE,
            contact,
            bankAccount,
            date,
            reference: `Booking ${booking.id} payment`,
            lineAmountTypes: LineAmountTypes.NoTax,
            lineItems,
          },
        ];
  }

  if (event === 'PAYOUT') {
    const lineItems = nonZero([line(cleanerNet, mapping.clearingAccountCode, 'Cleaner payout')]);
    return lineItems.length === 0
      ? []
      : [
          {
            type: BankTransaction.TypeEnum.SPEND,
            contact,
            bankAccount,
            date,
            reference: `Booking ${booking.id} cleaner payout`,
            lineAmountTypes: LineAmountTypes.NoTax,
            lineItems,
          },
        ];
  }

  // REFUND — reverse proportionally. cleaner share captured pre-mutation.
  const refundAmount = money(payload.refundAmount ?? 0);
  const cleanerPortion = money(payload.cleanerRefundPortion ?? 0);
  const { commission, fee } = splitRemainder(refundAmount - cleanerPortion);
  const txns: BankTransaction[] = [];

  // Customer refund: money leaves the bank (reverses commission/fee/clearing).
  const spendLines = nonZero([
    line(commission, mapping.commissionAccountCode, 'Refund — commission reversed'),
    line(fee, mapping.feeAccountCode, 'Refund — service fee reversed'),
    line(cleanerPortion, mapping.clearingAccountCode, 'Refund — cleaner share'),
  ]);
  if (spendLines.length > 0) {
    txns.push({
      type: BankTransaction.TypeEnum.SPEND,
      contact,
      bankAccount,
      date,
      reference: `Booking ${booking.id} refund ${payload.externalRef ?? ''}`.trim(),
      lineAmountTypes: LineAmountTypes.NoTax,
      lineItems: spendLines,
    });
  }

  // Post-release: the cleaner was already paid, so their share is clawed back
  // (A5.2 reverses the transfer) → money returns to the bank as a RECEIVE that
  // credits clearing. Net clearing nets to zero; net bank outflow = commission +
  // fee (Rena's real cost). Represents the ATTEMPTED reversal — if the cleaner
  // already withdrew, Stripe may create a negative balance Rena eats; the Xero
  // entry still records the intended clawback.
  if (payload.isPostRelease && cleanerPortion > 0) {
    txns.push({
      type: BankTransaction.TypeEnum.RECEIVE,
      contact,
      bankAccount,
      date,
      reference: `Booking ${booking.id} cleaner clawback ${payload.externalRef ?? ''}`.trim(),
      lineAmountTypes: LineAmountTypes.NoTax,
      lineItems: [line(cleanerPortion, mapping.clearingAccountCode, 'Cleaner share clawed back')],
    });
  }

  return txns;
}
