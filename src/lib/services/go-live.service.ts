// Two-stage verification (James-ruled): Stage 1 = identity verification
// (admin verifies Photo ID + Right to Work → profile.verified). Stage 2 =
// go-live readiness (insurance approved + Stripe payout onboarding), in any
// order. A cleaner becomes BOOKABLE only when both stages complete — the gate
// itself lives in eligibleCleanerWhere (area-search.service), shared by
// search, matching, area pages and the sitemap.
//
// This service owns the go-live MOMENT: whenever any of the three inputs
// flips (identity verify, insurance approval, Stripe webhook), call
// maybeMarkLive() — if the cleaner is now fully live and hasn't been told,
// it stamps liveNotifiedAt (exactly-once via an atomic guard) and sends the
// celebration email.

import prisma from '@/lib/db/prisma';
import { sendGoLive } from '@/lib/services/email.service';

export interface GoLiveState {
  verified: boolean;
  insuranceApproved: boolean;
  stripeComplete: boolean;
  live: boolean;
}

export function goLiveState(profile: {
  verified: boolean;
  insuranceVerified: boolean;
  insuranceExpiresAt: Date | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
}): GoLiveState {
  const insuranceApproved =
    profile.insuranceVerified &&
    (!profile.insuranceExpiresAt || profile.insuranceExpiresAt > new Date());
  const stripeComplete = profile.stripeChargesEnabled && profile.stripePayoutsEnabled;
  return {
    verified: profile.verified,
    insuranceApproved,
    stripeComplete,
    live: profile.verified && insuranceApproved && stripeComplete,
  };
}

/**
 * Fire-and-forget from every input's write path. Never throws.
 */
export async function maybeMarkLive(userId: string): Promise<void> {
  try {
    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId },
      select: {
        id: true,
        verified: true,
        insuranceVerified: true,
        insuranceExpiresAt: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        liveNotifiedAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!profile || profile.liveNotifiedAt) return;
    if (!goLiveState(profile).live) return;

    // Exactly-once: the stamp is claimed atomically; a concurrent caller's
    // updateMany matches zero rows and sends nothing.
    const claimed = await prisma.cleanerProfile.updateMany({
      where: { id: profile.id, liveNotifiedAt: null },
      data: { liveNotifiedAt: new Date() },
    });
    if (claimed.count === 0) return;

    await sendGoLive({
      name: profile.user.name || 'there',
      email: profile.user.email,
    }).catch(() => {});
  } catch {
    // go-live notification is best-effort — never break the calling write path
  }
}
