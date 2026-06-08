// Single place where the cleaner's transfer amount is determined.
// Currently: cleanerEarnings (= base price minus 10%/15% commission).
// Add-ons are not yet offered — when they are, decide here whether
// add-on revenue goes to the cleaner or the platform, and adjust
// the transfer amount accordingly. Do NOT compute it elsewhere.

export function getTransferAmountPence(cleanerEarnings: number): number {
  return Math.round(cleanerEarnings * 100);
}
