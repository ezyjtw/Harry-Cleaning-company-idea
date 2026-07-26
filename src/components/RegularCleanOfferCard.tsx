'use client';

// R1-A (amended): the post-completion offer card on the booking detail pages
// (authed /booking/[id] and the guest tokened page). Renders ONLY when the
// offer endpoint says the pair is eligible — completed clean, open slots, no
// active agreement. Never a dead-end CTA.

import { useEffect, useState } from 'react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface OfferResponse {
  eligible: boolean;
  cleanerId: string;
  cleanerName: string | null;
  usualSlot: { dayOfWeek: number; start: string; end: string } | null;
}

export default function RegularCleanOfferCard({
  bookingId,
  guestToken,
  className,
}: {
  bookingId: string;
  /** Present on the guest tokened page; omitted for the authed page. */
  guestToken?: string | null;
  className?: string;
}) {
  const [offer, setOffer] = useState<OfferResponse | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    const qs = guestToken ? `?token=${encodeURIComponent(guestToken)}` : '';
    fetch(`/api/bookings/${bookingId}/regular-offer${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOffer(data))
      .catch(() => {});
  }, [bookingId, guestToken]);

  if (!offer?.eligible) return null;

  const slotLine = offer.usualSlot
    ? `your ${DAY_NAMES[offer.usualSlot.dayOfWeek]} ${offer.usualSlot.start} slot is open`
    : 'they have slots open';
  const setupHref = guestToken
    ? `/regular-clean/${offer.cleanerId}?token=${encodeURIComponent(guestToken)}`
    : `/regular-clean/${offer.cleanerId}?from=${bookingId}`;

  return (
    <div
      className={`rounded-xl border border-primary/20 bg-primary-soft p-5 ${className ?? ''}`}
      data-testid="regular-offer-card"
    >
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
        Make it regular
      </p>
      <h2 className="mt-1 font-newsreader text-lg font-semibold text-ink">
        Loved your clean with {offer.cleanerName ?? 'your cleaner'}?
      </h2>
      <p className="mt-1 font-jost text-sm text-ink-2">
        Make it regular — {slotLine} for weekly or fortnightly cleans. No lock-in: you can end it
        any time.
      </p>
      <a
        href={setupHref}
        className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        Set up a regular clean
      </a>
    </div>
  );
}
