// Single place where the cleaner's transfer amount is determined.
// Currently: cleanerEarnings (= base price minus 10%/15% commission).
// Add-ons are not yet offered — when they are, decide here whether
// add-on revenue goes to the cleaner or the platform, and adjust
// the transfer amount accordingly. Do NOT compute it elsewhere.

export function getTransferAmountPence(cleanerEarnings: number): number {
  return Math.round(cleanerEarnings * 100);
}

// ─── Reconciliation Helpers (pure, testable) ─────────────

// States that require reconciliation before creating a new transfer.
// UNKNOWN: network error — transfer may or may not exist on Stripe.
// RELEASING: crash after stripe.transfers.create but before DB write.
const RECONCILE_STATES = ['UNKNOWN', 'RELEASING'] as const;

export function needsReconciliation(previousStatus: string): boolean {
  return (RECONCILE_STATES as readonly string[]).includes(previousStatus);
}

export interface TransferRecord {
  id: string;
  source_transaction: string | { id: string } | null;
}

export function findMatchingTransfer(transfers: TransferRecord[], chargeId: string): string | null {
  const match = transfers.find((t) => {
    if (typeof t.source_transaction === 'string') return t.source_transaction === chargeId;
    if (t.source_transaction && typeof t.source_transaction === 'object')
      return t.source_transaction.id === chargeId;
    return false;
  });
  return match?.id ?? null;
}
