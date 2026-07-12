// F10: where a notification takes you — ONE mapping shared by the web bell,
// the /notifications history page, and the future native /app/inbox. Keyed on
// type + data + the viewer's role (the same event reads differently for a
// cleaner vs a customer).

export interface NotificationLike {
  type: string;
  data?: { bookingId?: string; url?: string; senderId?: string } | null;
}

export function notificationHref(n: NotificationLike, role: string | null | undefined): string {
  const data = n.data ?? {};
  // An explicit url (e.g. the offer push's /app/offer/[id]) wins — but the web
  // bell lives outside the shell, so /app/* targets fall back to the portal.
  if (data.url && !data.url.startsWith('/app/')) return data.url;

  const isCleaner = role === 'CLEANER';
  switch (n.type) {
    case 'BOOKING_REQUEST':
      // A job offer — money leads. Cleaners act on it in their jobs list.
      return isCleaner ? '/cleaner/jobs' : data.bookingId ? `/booking/${data.bookingId}` : '/account/bookings';
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_CANCELLED':
    case 'BOOKING_COMPLETED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_SENT':
      if (isCleaner) return '/cleaner/jobs';
      return data.bookingId ? `/booking/${data.bookingId}` : '/account/bookings';
    case 'NEW_MESSAGE':
      return data.bookingId ? `/messages?bookingId=${data.bookingId}` : '/messages';
    case 'NEW_REVIEW':
      return isCleaner ? '/cleaner/reviews' : '/account/bookings';
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return '/disputes';
    case 'ACCOUNT_UPDATE':
      return isCleaner ? '/cleaner/profile' : '/account/settings';
    case 'SYSTEM':
    default:
      if (data.bookingId) {
        return isCleaner ? '/cleaner/jobs' : `/booking/${data.bookingId}`;
      }
      return '/notifications';
  }
}

/** Offer notifications visually lead in the feed — they're money. */
export function isOfferNotification(n: NotificationLike): boolean {
  return n.type === 'BOOKING_REQUEST';
}

// B4: the SAME mapping, app-shaped — inside the shell, /app/* URLs are native
// (the web-fallback inversion flips: an offer goes to /app/offer/[id], job
// notifications to the /app/jobs agenda). Everything else keeps its portal
// path, which the shell renders in-tab.
export function appNotificationHref(n: NotificationLike, role: string | null | undefined): string {
  const data = n.data ?? {};
  if (data.url && data.url.startsWith('/app/')) return data.url;
  if (role === 'CLEANER') {
    if (n.type === 'BOOKING_REQUEST') {
      return data.bookingId ? `/app/offer/${data.bookingId}` : '/app/jobs';
    }
    if (
      n.type === 'BOOKING_CONFIRMED' ||
      n.type === 'BOOKING_CANCELLED' ||
      n.type === 'BOOKING_COMPLETED' ||
      n.type === 'PAYMENT_RECEIVED' ||
      n.type === 'PAYMENT_SENT'
    ) {
      return '/app/jobs';
    }
  }
  return notificationHref(n, role);
}
