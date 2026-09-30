// R12 Lane 4 (James-ruled): ONE definition of "fully live" shared by the
// profile API (which the Pro shell reads for tab gating) and the dashboard
// API (which the checklist homepage reads). The two-stage law: identity
// verification (verified) and go-live (insurance approved + Stripe complete)
// are distinct moments; the real Today unlocks only at full go-live.

export interface GoLiveInput {
  verified: boolean;
  insuranceVerified: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
}

export function computeGoLive(p: GoLiveInput): boolean {
  return p.verified && p.insuranceVerified && p.stripeChargesEnabled && p.stripePayoutsEnabled;
}

export type DocumentChecklistStatus = 'missing' | 'reviewing' | 'approved' | 'declined';

/** Newest-doc-per-type rule (F8 supersession): a re-upload supersedes a
 *  rejection; a verified newest doc is approved; a present unrejected
 *  unverified newest doc is reviewing. */
export function documentStatuses(
  docs: Array<{
    documentType: string;
    isVerified: boolean;
    rejectedAt: Date | null;
    createdAt: Date;
  }>
): Record<string, DocumentChecklistStatus> {
  const newest = new Map<string, (typeof docs)[number]>();
  for (const d of [...docs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (!newest.has(d.documentType)) newest.set(d.documentType, d);
  }
  const out: Record<string, DocumentChecklistStatus> = {};
  for (const type of ['photo_id', 'right_to_work', 'dbs_certificate', 'insurance']) {
    const d = newest.get(type);
    out[type] = !d
      ? 'missing'
      : d.isVerified
        ? 'approved'
        : d.rejectedAt
          ? 'declined'
          : 'reviewing';
  }
  return out;
}
