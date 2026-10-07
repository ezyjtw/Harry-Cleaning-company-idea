// Single place where the cleaner's transfer amount is determined: the
// booking's cleanerEarnings, which already carries every share the cleaner is
// owed (the clean less its 10%/15% commission, the products add-on's 90%, and
// each database add-on's share at the parent service's rate unless the add-on
// defines its own; B4, D-a). Do NOT compute it elsewhere.

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
