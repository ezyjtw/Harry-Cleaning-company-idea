import { Resend } from 'resend';

import {
  buildBookingConfirmation,
  buildBookingReminder,
  buildCleanerReminder,
  buildBookingCancellation,
  buildRefundConfirmation,
  buildCleanerAssignment,
  buildPasswordReset,
  buildCleanerWelcome,
  buildEmailVerification,
  buildPaymentReceipt,
  buildContactConfirmation,
  buildSupportAlert,
  buildReviewRequest,
  buildDisputeOpenedCleaner,
  buildDisputeResolvedEmail,
  buildNewMessageEmail,
  buildGuestBookingConfirmation,
  buildGuestBookingReminder,
  buildAbandonmentEmail,
  buildVerificationDecision,
  buildTopupApprovalRequest,
  buildSignupNotification,
  buildPaymentFailureNotification,
  buildGoLive,
  type BookingEmailData,
  type UserEmailData,
  type CleanerEmailData,
  type PaymentEmailData,
} from '@/lib/services/email-templates';
import {
  shouldSend,
  type NotificationCategory,
} from '@/lib/services/notification-preferences.service';
import { generateUnsubscribeToken } from '@/lib/utils/unsubscribe-token';

// A11c: build the PECR unsubscribe URL + List-Unsubscribe headers for a marketing
// email to a known user. The header URL is the one-click POST endpoint (RFC 8058);
// the page URL is the friendly confirmation page shown in the wrapper footer.
function marketingUnsubscribe(
  userId: string,
  appUrl: string
): { pageUrl: string; headers: Record<string, string> } {
  const token = generateUnsubscribeToken(userId);
  const pageUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  const oneClickUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    pageUrl,
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// ─── Resend Client ──────────────────────────────────────────

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@renacleaning.co.uk';

// Force the "RENA" sender display name so every email lands as
// `RENA <noreply@renacleaning.co.uk>`, whether RESEND_FROM_EMAIL is a bare address
// or already "Name <addr>". The address is preserved; only the display name is set.
const FROM_WITH_NAME = (() => {
  if (!FROM_EMAIL) return FROM_EMAIL;
  const match = FROM_EMAIL.match(/<([^>]+)>/);
  const address = (match ? match[1] : FROM_EMAIL).trim();
  return `RENA <${address}>`;
})();

// ─── Helper ─────────────────────────────────────────────────

// A11: THE email chokepoint. Every email send routes through here, so the
// preference gate lives here. `category` defaults to ESSENTIAL — transactional &
// security emails (booking/payment confirms, receipts, password reset, email
// verification, admin/support alerts) always send and never read a preference
// row. Toggleable (REMINDER/NEW_MESSAGE) and MARKETING senders pass an explicit
// category + the recipient's `userId` so the gate can honour their choice /
// consent. A null userId on a marketing send means no consent on record ⇒ suppressed.
async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  opts?: {
    userId?: string | null;
    category?: NotificationCategory;
    headers?: Record<string, string>;
    // H88: inbound-style mail (contact-form alerts) sets reply-to to the
    // customer so the team answers them directly, not the from-address.
    replyTo?: string;
    // F8: optional file attachments (e.g. the accepted-job .ics).
    attachments?: Array<{ filename: string; content: string }>;
  }
): Promise<boolean> {
  const category = opts?.category ?? 'ESSENTIAL';
  const userId = opts?.userId ?? null;

  if (!(await shouldSend(userId, category, 'EMAIL'))) {
    // eslint-disable-next-line no-console
    console.log(`[Email] Suppressed by preference (category=${category}) to: ${to}`);
    return false;
  }

  // Dev-only failure drill (H99 P3): EMAIL_FORCE_FAIL=1 makes every send
  // report failure so the loud-both-ways legs can be driven without touching
  // the code under test. Ignored in production builds.
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_FORCE_FAIL === '1') {
    // eslint-disable-next-line no-console
    console.error(`[Email] DEV FORCED FAILURE (${category}) to: ${to} — ${subject}`);
    return false;
  }
  if (process.env.NODE_ENV !== 'production' || !resend) {
    // eslint-disable-next-line no-console
    console.log('─────────────────────────────────────────');
    // eslint-disable-next-line no-console
    console.log(`[Email] To: ${to}`);
    // eslint-disable-next-line no-console
    console.log(`[Email] Subject: ${subject}`);
    if (opts?.replyTo) {
      // eslint-disable-next-line no-console
      console.log(`[Email] Reply-To: ${opts.replyTo}`);
    }
    // eslint-disable-next-line no-console
    console.log(`[Email] Body preview: ${htmlBody.substring(0, 200)}...`);
    // eslint-disable-next-line no-console
    console.log('─────────────────────────────────────────');
    return true;
  }

  try {
    const result = await resend?.emails.send({
      from: FROM_WITH_NAME,
      to,
      subject,
      html: htmlBody,
      ...(opts?.headers ? { headers: opts.headers } : {}),
      ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts?.attachments ? { attachments: opts.attachments } : {}),
    });
    // H73: the Resend SDK does NOT throw on API errors — it resolves with
    // { data, error }. The old code ignored the response, so a REJECTED send
    // (bad from-address, suppressed recipient, rate limit) still logged "Sent".
    // Inspect the envelope: rejections log loudly, successes log the provider
    // message id so any single email's delivery can be traced in the Resend
    // dashboard.
    if (result?.error) {
      // eslint-disable-next-line no-console
      console.error(
        `[Email] Provider REJECTED (${category}) to: ${to} — ${subject}: ` +
          `${result.error.name}/${result.error.statusCode ?? '-'} ${result.error.message}`
      );
      return false;
    }
    // H68: prod sends were INVISIBLE (success silent, failures easy to miss) —
    // one line per send so "attempted or not" is always answerable from logs.
    // eslint-disable-next-line no-console
    console.log(`[Email] Sent (${category}) to: ${to} — ${subject} (id: ${result?.data?.id})`);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Email] Failed to send to ${to}:`, error);
    return false;
  }
}

// ─── Booking Emails ─────────────────────────────────────────

export async function sendBookingConfirmation(
  booking: BookingEmailData,
  user: UserEmailData
): Promise<boolean> {
  const { subject, html } = buildBookingConfirmation(booking, user);
  return sendEmail(user.email, subject, html);
}

export async function sendBookingReminder(
  booking: BookingEmailData,
  user: UserEmailData,
  userId?: string | null
): Promise<boolean> {
  const { subject, html } = buildBookingReminder(booking, user);
  return sendEmail(user.email, subject, html, { userId: userId ?? null, category: 'REMINDER' });
}

export async function sendCleanerReminder(
  booking: BookingEmailData,
  cleaner: CleanerEmailData,
  userId?: string | null
): Promise<boolean> {
  const { subject, html } = buildCleanerReminder(booking, cleaner);
  return sendEmail(cleaner.email, subject, html, { userId: userId ?? null, category: 'REMINDER' });
}

export async function sendBookingCancellation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundInfo?: { refundAmount: number; refundPercent: number }
): Promise<boolean> {
  const { subject, html } = buildBookingCancellation(booking, user, refundInfo);
  return sendEmail(user.email, subject, html);
}

export async function sendRefundConfirmation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundAmount: number,
  isFullRefund: boolean
): Promise<boolean> {
  const { subject, html } = buildRefundConfirmation(booking, user, refundAmount, isFullRefund);
  return sendEmail(user.email, subject, html);
}

export async function sendCleanerAssignment(
  // F1: the offer email requires the SANITISED area (never the full address).
  booking: BookingEmailData & { area: string; cleanerEarnings?: number },
  cleaner: CleanerEmailData
): Promise<boolean> {
  const { subject, html } = buildCleanerAssignment(booking, cleaner);
  return sendEmail(cleaner.email, subject, html);
}

// ─── Account Emails ─────────────────────────────────────────

export async function sendPasswordReset(email: string, token: string): Promise<boolean> {
  const { subject, html } = buildPasswordReset(token);
  return sendEmail(email, subject, html);
}

export async function sendEmailVerification(email: string, token: string): Promise<boolean> {
  const { subject, html } = buildEmailVerification(token);
  return sendEmail(email, subject, html);
}

// H99 ①: welcome-framed verify at cleaner account creation (wizard step 0).
export async function sendCleanerWelcome(
  email: string,
  token: string,
  firstName: string
): Promise<boolean> {
  const { subject, html } = buildCleanerWelcome(token, firstName);
  return sendEmail(email, subject, html);
}

// ─── Payment Emails ─────────────────────────────────────────

export async function sendPaymentReceipt(
  payment: PaymentEmailData,
  user: UserEmailData
): Promise<boolean> {
  const { subject, html } = buildPaymentReceipt(payment, user);
  return sendEmail(user.email, subject, html);
}

// ─── Contact Emails ─────────────────────────────────────────

export async function sendContactConfirmation(
  email: string,
  name: string,
  subject: string
): Promise<boolean> {
  const { subject: builtSubject, html } = buildContactConfirmation(name, subject);
  return sendEmail(email, builtSubject, html);
}

export async function sendSupportAlert(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  bookingRef?: string;
}): Promise<boolean> {
  const { subject, html } = buildSupportAlert(data);
  // H88: reply-to is the customer — a plain "Reply" in the support inbox
  // answers them, honouring the contact form's 24-hour promise.
  return sendEmail(SUPPORT_EMAIL, subject, html, { replyTo: data.email });
}

// ─── Review Request Email ──────────────────────────────────

export async function sendReviewRequest(
  booking: BookingEmailData,
  user: UserEmailData,
  userId?: string | null
): Promise<boolean> {
  // R1-A (amended): the completion email is the recurring entry point — when
  // this pair is offer-eligible (completed clean + open slots + no active
  // agreement), the review request carries the "make it regular" section.
  // Resolution failure never blocks the review email itself.
  let offer: Parameters<typeof buildReviewRequest>[2] = undefined;
  try {
    const { getRegularCleanOffer } = await import('@/lib/services/regular-offer.service');
    const o = await getRegularCleanOffer(booking.id);
    if (o.eligible && o.cleanerId) {
      offer = {
        cleanerName: o.cleanerName ?? 'your cleaner',
        usualSlot: o.usualSlot ?? null,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network'}/regular-clean/${o.cleanerId}?from=${booking.id}`,
      };
    }
  } catch {
    offer = undefined;
  }
  const { subject, html } = buildReviewRequest(booking, user, offer);
  return sendEmail(user.email, subject, html, { userId: userId ?? null, category: 'REMINDER' });
}

// R1-A (amended): guest completion email. Guests get NO review request (parked
// ruling — reviews need an account), so this dedicated email exists ONLY to
// carry the regular-clean offer, and only when the pair is offer-eligible.
// Not eligible → no email at all (named skip in the caller's log).
export async function sendGuestCompletionOffer(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { guestEmail: true, guestName: true, guestToken: true, clientId: true },
  });
  if (!b || b.clientId || !b.guestEmail || !b.guestToken) return false;
  const { getRegularCleanOffer } = await import('@/lib/services/regular-offer.service');
  const offer = await getRegularCleanOffer(bookingId);
  if (!offer.eligible || !offer.cleanerId) {
    // eslint-disable-next-line no-console
    console.log(`[RegularOffer] Guest completion email skipped for ${bookingId} — ${offer.reason}`);
    return false;
  }
  const { buildGuestCompletionOffer } = await import('./email-templates');
  const { subject, html } = buildGuestCompletionOffer({
    guestName: b.guestName ?? 'there',
    cleanerName: offer.cleanerName ?? 'your cleaner',
    usualSlot: offer.usualSlot ?? null,
    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network'}/regular-clean/${offer.cleanerId}?token=${encodeURIComponent(b.guestToken)}`,
  });
  return sendEmail(b.guestEmail, subject, html);
}

// ─── Dispute Emails ─────────────────────────────────────────

// H43: email the assigned cleaner that a problem was reported. ESSENTIAL
// category — a paused payout is not a marketing nicety they can opt out of.
// H62 (the rule): every dispute resolution emails BOTH parties — outcome,
// what happens to the money, and when. Refund flavours ALSO send the standard
// refund confirmation (amount + timeline) to the customer, but only when the
// refund actually succeeded — a failed attempt (stuck-money retry queue) gets
// the honest "approved and being processed" wording instead. Guest-safe: the
// customer side resolves to the client's email or the guest email.
// H62: the standard refund confirmation (amount + 5-10 day timeline), resolved
// guest-safe from the booking. Used by the dispute-resolution sender and by
// the stuck-refund retry path — the ONLY places a refund is confirmed after
// the fact (first-attempt refunds in cancel flows carry their refund info in
// the cancellation email itself).
export async function sendRefundConfirmationForBooking(
  bookingId: string,
  refundAmount: number,
  isFullRefund: boolean
): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      date: true,
      startTime: true,
      serviceType: true,
      totalPrice: true,
      guestEmail: true,
      guestName: true,
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (!b) return false;
  const email = b.client?.email ?? b.guestEmail;
  const name = b.client?.name ?? b.guestName ?? 'there';
  if (!email) return false;
  const { subject, html } = buildRefundConfirmation(
    {
      id: b.id,
      customerName: name,
      date: b.date.toLocaleDateString('en-GB'),
      time: b.startTime,
      address: '',
      serviceType: b.serviceType,
      totalPrice: Number(b.totalPrice),
    },
    { name, email },
    refundAmount,
    isFullRefund
  );
  return sendEmail(email, subject, html, { userId: b.client?.id ?? null, category: 'ESSENTIAL' });
}

export async function sendDisputeResolutionEmails(opts: {
  bookingId: string;
  outcome: 'release-to-cleaner' | 'refund-customer' | 'split';
  refundAmount?: number;
  refundSucceeded?: boolean;
}): Promise<void> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: opts.bookingId },
    select: {
      id: true,
      date: true,
      startTime: true,
      serviceType: true,
      totalPrice: true,
      clientId: true,
      guestEmail: true,
      guestName: true,
      guestToken: true,
      client: { select: { id: true, name: true, email: true } },
      cleaner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!b) {
    // eslint-disable-next-line no-console
    console.error(
      `[DisputeEmail] booking ${opts.bookingId} not found — resolution emails NOT sent`
    );
    return;
  }

  const dateStr = b.date.toLocaleDateString('en-GB');
  const isRefundOutcome = opts.outcome === 'refund-customer' || opts.outcome === 'split';
  const refundPending = isRefundOutcome && !opts.refundSucceeded;

  const customerEmail = b.client?.email ?? b.guestEmail;
  const customerName = b.client?.name ?? b.guestName ?? 'there';
  if (!customerEmail) {
    // eslint-disable-next-line no-console
    console.error(
      `[DisputeEmail] booking ${opts.bookingId} has NO customer email (client null, guestEmail null) — customer NOT emailed`
    );
  }
  if (customerEmail) {
    const { subject, html } = buildDisputeResolvedEmail({
      audience: 'customer',
      name: customerName,
      dateStr,
      outcome: opts.outcome,
      refundAmount: opts.refundAmount,
      refundPending,
      bookingId: opts.bookingId,
      // H69: a true guest can't open /disputes — link their tokened case view.
      caseUrl:
        !b.client && b.guestToken
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk'}/booking/guest?token=${encodeURIComponent(b.guestToken)}`
          : undefined,
    });
    await sendEmail(customerEmail, subject, html, {
      userId: b.client?.id ?? null,
      category: 'ESSENTIAL',
    });

    // The standard refund confirmation rides along on a SUCCESSFUL refund.
    if (isRefundOutcome && opts.refundSucceeded && opts.refundAmount) {
      await sendRefundConfirmationForBooking(
        opts.bookingId,
        opts.refundAmount,
        opts.outcome === 'refund-customer'
      );
    }
  }

  if (b.cleaner?.email) {
    const { subject, html } = buildDisputeResolvedEmail({
      audience: 'cleaner',
      name: b.cleaner.name ?? 'there',
      dateStr,
      outcome: opts.outcome,
      refundAmount: opts.refundAmount,
      bookingId: opts.bookingId,
    });
    await sendEmail(b.cleaner.email, subject, html, {
      userId: b.cleaner.id,
      category: 'ESSENTIAL',
    });
  }
}

export async function sendDisputeOpenedToCleaner(opts: {
  cleanerEmail: string;
  cleanerName: string;
  cleanerUserId: string;
  dateStr: string;
  reasonLabel: string;
  /** H64: traceability — carried into the email as the display reference. */
  bookingId?: string;
}): Promise<boolean> {
  const { subject, html } = buildDisputeOpenedCleaner({
    cleanerName: opts.cleanerName,
    dateStr: opts.dateStr,
    reasonLabel: opts.reasonLabel,
    bookingId: opts.bookingId,
  });
  return sendEmail(opts.cleanerEmail, subject, html, {
    userId: opts.cleanerUserId,
    category: 'ESSENTIAL',
  });
}

// ─── New Message Email ──────────────────────────────────────

/**
 * Notifies a recipient that they have a new message. Deliberately does NOT include
 * the message body (it can contain PII / off-platform contact details) — it links
 * back to the on-platform thread, which keeps the conversation (and payments) on
 * Rena. Sent first-unread-only (gated by the caller) to avoid re-nagging.
 */
export async function sendNewMessageEmail(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  recipientUserId: string
): Promise<boolean> {
  const { subject, html } = buildNewMessageEmail(recipientName, senderName);
  // Toggleable: honour the recipient's new-message-alert preference.
  return sendEmail(recipientEmail, subject, html, {
    userId: recipientUserId,
    category: 'NEW_MESSAGE',
  });
}

// ─── Guest Booking Email ────────────────────────────────────

export async function sendGuestBookingConfirmation(
  booking: BookingEmailData,
  email: string,
  guestName: string,
  guestToken: string
): Promise<boolean> {
  // H6: the create-account CTA belongs to addresses that DON'T have an account.
  // A guest checkout with an existing customer's email gets the sign-in line
  // instead (claim-on-login then surfaces the booking in their account). The
  // lookup is best-effort — on error we keep the guest CTA rather than block
  // the confirmation.
  let hasAccount = false;
  try {
    const { prisma } = await import('@/lib/db/prisma');
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: email.toLowerCase().trim(), mode: 'insensitive' },
        isDeleted: false,
      },
      select: { id: true },
    });
    hasAccount = !!existing;
  } catch {
    hasAccount = false;
  }
  const { subject, html } = buildGuestBookingConfirmation(
    booking,
    email,
    guestName,
    guestToken,
    hasAccount
  );
  return sendEmail(email, subject, html);
}

// Guest 24h reminder. Transactional (a booking the guest placed) → ESSENTIAL, so
// it always sends; the caller only reaches this when the booking is not
// cancelled. Guests have no account/preference row; the manage-booking link is
// the opt-out.
export async function sendGuestBookingReminder(
  booking: BookingEmailData,
  email: string,
  guestName: string,
  guestToken: string
): Promise<boolean> {
  const { subject, html } = buildGuestBookingReminder(booking, guestName, guestToken);
  return sendEmail(email, subject, html);
}

// ─── Abandonment Email ──────────────────────────────────────

export async function sendAbandonmentEmail(
  email: string,
  data: { cleanerName?: string; postcode?: string; personalizedMessage: string; userId?: string }
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // A11c (PECR): a real, working unsubscribe. Marketing only ever sends with a
  // userId (the gate suppresses consent-less sends), so we can always mint a
  // signed token. Footer link → friendly page; List-Unsubscribe header → one-click.
  const { pageUrl, headers } = data.userId
    ? marketingUnsubscribe(data.userId, appUrl)
    : { pageUrl: undefined, headers: undefined };

  const { subject, html } = buildAbandonmentEmail(data, pageUrl);

  // MARKETING (PECR): opt-in only. Suppressed unless the recipient has an explicit,
  // un-revoked marketing consent on record. Guest leads (no userId) have no consent
  // ⇒ suppressed by default.
  return sendEmail(email, subject, html, {
    userId: data.userId ?? null,
    category: 'MARKETING',
    headers,
  });
}

// ─── Verification Decision Email ───────────────────────────

export async function sendVerificationDecision(data: {
  cleanerName: string;
  cleanerEmail: string;
  approved: boolean;
  reason?: string;
}): Promise<boolean> {
  const { subject, html } = buildVerificationDecision(data);
  return sendEmail(data.cleanerEmail, subject, html);
}

// ─── Top-Up Approval Request Email (A5.3) ─────────────────

export async function sendTopupApprovalRequest(data: {
  bookingId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  originalPrice: number;
  newPrice: number;
  topupAmount: number;
  expiresAt: Date;
}): Promise<boolean> {
  // F5 guest parity: resolve the recipient from the booking — registered
  // customers get the plain link, guests get the SAME email with their
  // capability token in the approval link. Call sites no longer need
  // client-only gates.
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      clientId: true,
      guestToken: true,
      guestEmail: true,
      guestName: true,
      client: { select: { email: true, name: true } },
    },
  });
  const email = data.customerEmail ?? b?.client?.email ?? b?.guestEmail ?? null;
  const name = data.customerName ?? b?.client?.name ?? b?.guestName ?? 'there';
  const guestToken = b && !b.clientId ? b.guestToken : null;
  if (!email) return false;
  const { subject, html } = buildTopupApprovalRequest({
    bookingId: data.bookingId,
    customerName: name,
    originalPrice: data.originalPrice,
    newPrice: data.newPrice,
    topupAmount: data.topupAmount,
    expiresAt: data.expiresAt,
    guestToken,
  });
  return sendEmail(email, subject, html);
}

// ─── M3 rescue: cleaner cancelled ──────────────────────────

export async function sendCleanerCancelledRescue(data: {
  bookingId: string;
  customerName: string;
  customerEmail: string | null;
  guestToken: string | null;
  serviceType: string;
  date: Date;
  startTime: string;
  deadline: Date;
}): Promise<boolean> {
  if (!data.customerEmail) return false; // no reachable customer — sweep still protects them
  const { buildCleanerCancelledRescue } = await import('./email-templates');
  const { subject, html } = buildCleanerCancelledRescue(data);
  return sendEmail(data.customerEmail, subject, html);
}

// ─── H15: acceptance moment ─────────────────────────────────

/**
 * Emails the customer WHO took their clean, the moment any cleaner accepts —
 * direct, backup, Rena-Find, rescue-① or rebook (called from the atomic accept
 * functions so no route can forget it). Both audiences: registered customers
 * get the plain booking link, guests the tokened one. Best-effort.
 */
export async function sendCleanerAcceptedBooking(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true,
      guestToken: true,
      guestEmail: true,
      guestName: true,
      serviceType: true,
      date: true,
      startTime: true,
      client: { select: { email: true, name: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!b) return false;
  const email = b.client?.email ?? b.guestEmail;
  if (!email) return false;
  const { buildCleanerAcceptedBooking } = await import('./email-templates');
  const { subject, html } = buildCleanerAcceptedBooking({
    bookingId,
    customerName: b.client?.name ?? b.guestName ?? 'there',
    cleanerName: b.cleaner?.name ?? 'Your cleaner',
    serviceType: b.serviceType,
    date: b.date,
    startTime: b.startTime,
    guestToken: b.clientId ? null : b.guestToken,
  });
  return sendEmail(email, subject, html);
}

// F11 (James-ruled, live find from the drill): backups previously got an
// in-app bell only at the PRIMARY_OFFER → BACKUP_OFFER flip — no email. Each
// active backup now gets the F1 offer email (Accept deep link, area-only,
// THEIR OWN net figure via their quote — never the primary's). The caller
// passes the already-pruned active set, so the H63 corpse law holds: no email
// to declined/excluded/unavailable cleaners.
export async function sendBackupOfferEmails(bookingId: string, backupIds: string[]): Promise<void> {
  if (backupIds.length === 0) return;
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return;
  const { serviceLabelFromSlug, normalizeToPricingSlug, propertySizeEnumToSlug } =
    await import('@/lib/constants/services');
  const { pricingService } = await import('@/lib/services/pricing.service');
  const users = await prisma.user.findMany({
    where: { id: { in: backupIds } },
    select: { id: true, name: true, email: true },
  });
  const area = [b.addressCity, b.addressPostcode].filter(Boolean).join(' ');
  const dateStr = b.date.toISOString().split('T')[0];
  for (const u of users) {
    if (!u.email) continue;
    // The backup's OWN at-or-below figure — the same quote the jobs list shows
    // them. If quoting fails, the earnings row is simply omitted (never the
    // primary's figure, never the customer total).
    let earnings: number | undefined;
    try {
      const quote = await pricingService.calculateQuote({
        cleanerId: u.id,
        serviceSlug: normalizeToPricingSlug(b.serviceType) as never,
        hours: Number(b.duration),
        propertySize: b.propertySize ? propertySizeEnumToSlug(b.propertySize as never) : undefined,
        addons: b.extras,
      });
      earnings = quote.cleanerPayout;
    } catch {
      earnings = undefined;
    }
    await sendCleanerAssignment(
      {
        id: b.id,
        customerName: '',
        date: dateStr,
        time: b.startTime,
        address: area,
        serviceType: b.serviceType,
        totalPrice: 0,
        area,
        cleanerEarnings: earnings,
      },
      { name: u.name || 'there', email: u.email }
    ).catch(() => {});
  }
  // eslint-disable-next-line no-console
  console.log(
    `[Cascade] backup-offer emails attempted for ${bookingId}: ${users.filter((u) => u.email).length} of ${backupIds.length} backups (${serviceLabelFromSlug(b.serviceType)})`
  );
}

// F8: the CLEANER's acceptance confirmation — new email; before this only the
// customer heard about an accept. Carries the .ics attachment (full address in
// LOCATION per the address law — this recipient just became the assigned
// cleaner). Notes/entry details stay OUT of both email and .ics; the job
// detail link is the door.
export async function sendCleanerJobAccepted(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { cleaner: { select: { id: true, name: true, email: true } } },
  });
  if (!b?.cleaner?.email) return false;
  const { serviceLabelFromSlug } = await import('@/lib/constants/services');
  const { getTransferAmountPence } = await import('@/lib/services/transfer-amount');
  const { buildJobIcs } = await import('@/lib/services/job-ics');
  const { buildCleanerJobAccepted } = await import('./email-templates');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network';
  const dateStr = b.date.toISOString().split('T')[0];
  const fullAddress = [b.addressLine1, b.addressLine2, b.addressCity, b.addressPostcode]
    .filter(Boolean)
    .join(', ');
  const earnings = getTransferAmountPence(Number(b.cleanerEarnings)) / 100;
  const detailUrl = `${appUrl}/cleaner/jobs/${b.id}`;

  const ics = buildJobIcs({
    id: b.id,
    serviceLabel: serviceLabelFromSlug(b.serviceType),
    date: dateStr,
    startTime: b.startTime,
    durationHours: Number(b.duration),
    fullAddress,
    cleanerEarnings: earnings,
    detailUrl,
  });
  const { subject, html } = buildCleanerJobAccepted({
    cleanerName: b.cleaner.name || 'there',
    serviceLabel: serviceLabelFromSlug(b.serviceType),
    date: dateStr,
    time: b.startTime,
    earnings,
    detailUrl,
  });
  return sendEmail(b.cleaner.email, subject, html, {
    userId: b.cleaner.id,
    attachments: [{ filename: `rena-clean-${dateStr}.ics`, content: ics }],
  });
}

// R1-A: agreement-ended notice to the AFFECTED party (the other side gets a
// bell from the recurring service). Cleaner ended → customer/guest email;
// customer ended → cleaner email. Guest parity: guest agreements have
// guestEmail on the agreement row itself.
export async function sendAgreementEnded(
  agreementId: string,
  endedBy: 'CLEANER' | 'CUSTOMER'
): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const a = await prisma.recurringAgreement.findUnique({
    where: { id: agreementId },
    include: {
      cleaner: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (!a) return false;
  const { serviceLabelFromSlug } = await import('@/lib/constants/services');
  const { buildAgreementEnded } = await import('./email-templates');

  const frequencyLabel = a.frequency === 'WEEKLY' ? 'weekly' : 'fortnightly';
  const serviceLabel = serviceLabelFromSlug(a.serviceType);

  let to: string | null;
  let recipientName: string;
  let otherPartyName: string;
  let userId: string | undefined;
  if (endedBy === 'CLEANER') {
    to = a.client?.email ?? a.guestEmail;
    recipientName = a.client?.name ?? a.guestName ?? 'there';
    otherPartyName = a.cleaner.name || 'Your cleaner';
    userId = a.client?.id;
  } else {
    to = a.cleaner.email;
    recipientName = a.cleaner.name || 'there';
    otherPartyName = a.client?.name ?? a.guestName ?? 'Your client';
    userId = a.cleaner.id;
  }
  if (!to) return false;

  const { subject, html } = buildAgreementEnded({
    recipientName,
    endedBy,
    otherPartyName,
    serviceLabel,
    frequencyLabel,
  });
  return sendEmail(to, subject, html, userId ? { userId } : undefined);
}

// R1-B: the single-attempt failure email — "pay now to keep your slot". The
// link is the occurrence's ON-SESSION checkout (/pay/[id]); guests carry their
// token. ESSENTIAL category — a payment problem is never opt-out-able.
export async function sendOccurrencePayNow(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      date: true,
      startTime: true,
      guestEmail: true,
      guestName: true,
      guestToken: true,
      clientId: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!b) return false;
  const to = b.client?.email ?? b.guestEmail;
  if (!to) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network';
  const payUrl = b.clientId
    ? `${appUrl}/pay/${bookingId}`
    : `${appUrl}/pay/${bookingId}?token=${encodeURIComponent(b.guestToken ?? '')}`;
  const dateLong = b.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const { buildOccurrencePayNow } = await import('./email-templates');
  const { subject, html } = buildOccurrencePayNow({
    customerName: b.client?.name ?? b.guestName ?? 'there',
    cleanerName: b.cleaner?.name ?? 'your cleaner',
    dateLong,
    time: b.startTime,
    payUrl,
  });
  return sendEmail(to, subject, html);
}

// R1-B race fix: full-refund notice when a payment landed on an
// already-cancelled occurrence. ESSENTIAL — it explains money movement.
export async function sendOccurrenceLatePaymentRefunded(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      date: true,
      totalAmountCharged: true,
      totalPrice: true,
      guestEmail: true,
      guestName: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!b) return false;
  const to = b.client?.email ?? b.guestEmail;
  if (!to) return false;
  const { buildOccurrenceLatePaymentRefunded } = await import('./email-templates');
  const { subject, html } = buildOccurrenceLatePaymentRefunded({
    customerName: b.client?.name ?? b.guestName ?? 'there',
    cleanerName: b.cleaner?.name ?? 'your cleaner',
    dateLong: b.date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
    amount: Number(b.totalAmountCharged ?? b.totalPrice),
  });
  return sendEmail(to, subject, html);
}

// R1-C: unpaid occurrence can't-make-it — no-charge choice email. The CTA
// lands on the booking's choice surface (account detail or guest tokened page).
export async function sendOccurrenceCantMake(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      date: true,
      startTime: true,
      clientId: true,
      guestEmail: true,
      guestName: true,
      guestToken: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!b) return false;
  const to = b.client?.email ?? b.guestEmail;
  if (!to) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network';
  const chooseUrl = b.clientId
    ? `${appUrl}/booking/${bookingId}`
    : `${appUrl}/booking/guest?token=${encodeURIComponent(b.guestToken ?? '')}`;
  const { buildOccurrenceCantMake } = await import('./email-templates');
  const { subject, html } = buildOccurrenceCantMake({
    customerName: b.client?.name ?? b.guestName ?? 'there',
    cleanerName: b.cleaner?.name ?? 'Your cleaner',
    dateLong: b.date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
    time: b.startTime,
    chooseUrl,
  });
  return sendEmail(to, subject, html);
}

// R1-C: the holiday batch email — one per customer, all their affected cleans.
export async function sendHolidayBatch(params: {
  bookingIds: string[];
  startDate: string;
  endDate: string;
}): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const rows = await prisma.booking.findMany({
    where: { id: { in: params.bookingIds } },
    select: {
      id: true,
      date: true,
      startTime: true,
      paymentStatus: true,
      clientId: true,
      guestEmail: true,
      guestName: true,
      guestToken: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });
  if (rows.length === 0) return false;
  const first = rows[0];
  const to = first.client?.email ?? first.guestEmail;
  if (!to) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renacleaning.network';
  const chooseUrl = first.clientId
    ? `${appUrl}/account`
    : `${appUrl}/booking/guest?token=${encodeURIComponent(first.guestToken ?? '')}`;
  const longDate = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  const { buildHolidayBatch } = await import('./email-templates');
  const { subject, html } = buildHolidayBatch({
    customerName: first.client?.name ?? first.guestName ?? 'there',
    cleanerName: first.cleaner?.name ?? 'Your cleaner',
    startLong: longDate(params.startDate),
    endLong: longDate(params.endDate),
    count: rows.length,
    cleans: rows.map((r) => ({
      dateLong: r.date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
      time: r.startTime,
      paid: r.paymentStatus === 'SUCCEEDED',
    })),
    chooseUrl,
  });
  return sendEmail(to, subject, html);
}

// R1-B: the T-24h auto-cancel email — honest copy, agreement survives.
export async function sendOccurrenceAutoCancelled(bookingId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      date: true,
      guestEmail: true,
      guestName: true,
      client: { select: { name: true, email: true } },
      cleaner: { select: { name: true } },
    },
  });
  if (!b) return false;
  const to = b.client?.email ?? b.guestEmail;
  if (!to) return false;
  const dateLong = b.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const { buildOccurrenceAutoCancelled } = await import('./email-templates');
  const { subject, html } = buildOccurrenceAutoCancelled({
    customerName: b.client?.name ?? b.guestName ?? 'there',
    cleanerName: b.cleaner?.name ?? 'your cleaner',
    dateLong,
  });
  return sendEmail(to, subject, html);
}

// ─── X1 cascade milestone emails ───────────────────────────

async function resolveBookingRecipient(bookingId: string): Promise<{
  email: string;
  name: string;
  guestToken: string | null;
  serviceType: string;
  date: Date;
} | null> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true,
      guestToken: true,
      guestEmail: true,
      guestName: true,
      serviceType: true,
      date: true,
      client: { select: { email: true, name: true } },
    },
  });
  if (!b) return null;
  const email = b.client?.email ?? b.guestEmail;
  if (!email) return null;
  return {
    email,
    name: b.client?.name ?? b.guestName ?? 'there',
    guestToken: b.clientId ? null : b.guestToken,
    serviceType: b.serviceType,
    date: b.date,
  };
}

/** X1: chosen cleaner → searching. NEVER silent — both audiences. */
export async function sendCascadeSearchingUpdate(bookingId: string): Promise<boolean> {
  const r = await resolveBookingRecipient(bookingId);
  if (!r) return false;
  const { buildCascadeSearchingUpdate } = await import('./email-templates');
  const { subject, html } = buildCascadeSearchingUpdate({
    bookingId,
    customerName: r.name,
    serviceType: r.serviceType,
    date: r.date,
    guestToken: r.guestToken,
  });
  return sendEmail(r.email, subject, html);
}

/** X1: searching → Rena-Find. The concierge reassurance — both audiences. */
export async function sendRenaFindConcierge(bookingId: string): Promise<boolean> {
  const r = await resolveBookingRecipient(bookingId);
  if (!r) return false;
  const { buildRenaFindConcierge } = await import('./email-templates');
  const { subject, html } = buildRenaFindConcierge({
    bookingId,
    customerName: r.name,
    serviceType: r.serviceType,
    date: r.date,
    guestToken: r.guestToken,
  });
  return sendEmail(r.email, subject, html);
}

/** X1: exhausted → full auto-refund. Both audiences. */
export async function sendCascadeExhaustedRefund(bookingId: string): Promise<boolean> {
  const r = await resolveBookingRecipient(bookingId);
  if (!r) return false;
  const { buildCascadeExhaustedRefund } = await import('./email-templates');
  const { subject, html } = buildCascadeExhaustedRefund({
    bookingId,
    customerName: r.name,
    serviceType: r.serviceType,
    date: r.date,
    guestToken: r.guestToken,
  });
  return sendEmail(r.email, subject, html);
}

// ─── Signup Notification Email ─────────────────────────────

export async function sendSignupNotification(data: {
  name: string;
  email: string;
  phone?: string;
  role: 'CLIENT' | 'CLEANER';
  createdAt: string;
}): Promise<boolean> {
  const notificationEmail = process.env.RESEND_NOTIFICATION_EMAIL;
  if (!notificationEmail) return false;

  const { subject, html } = buildSignupNotification(data);
  return sendEmail(notificationEmail, subject, html);
}

// ─── Payment Failure Email ─────────────────────────────────

export async function sendPaymentFailureNotification(
  data: { bookingId: string; customerName: string; reason: string },
  user: UserEmailData
): Promise<boolean> {
  const { subject, html } = buildPaymentFailureNotification(data);
  return sendEmail(user.email, subject, html);
}

// ─── Go-live (two-stage flow) ───────────────────────────────

export async function sendGoLive(user: { name: string; email: string }): Promise<boolean> {
  const { subject, html } = buildGoLive({ name: user.name });
  return sendEmail(user.email, subject, html);
}

// ─── Stuck-money reaper (James-approved) ─────────────────────

/** Cleaner nudge (ESSENTIAL — a blocked payout is not an optional reminder). */
export async function sendStuckJobNudge(bookingId: string, escalated: boolean): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      serviceType: true,
      date: true,
      startTime: true,
      cleanerId: true,
      cleaner: { select: { name: true, email: true } },
    },
  });
  if (!b?.cleaner?.email) return false;
  const { buildStuckJobNudge } = await import('./email-templates');
  const { subject, html } = buildStuckJobNudge({
    cleanerName: b.cleaner.name ?? 'there',
    serviceType: b.serviceType,
    date: b.date,
    startTime: b.startTime,
    escalated,
  });
  return sendEmail(b.cleaner.email, subject, html);
}

/** Ask-the-customer (ESSENTIAL, guest-safe). */
export async function sendJobHappenedAsk(bookingId: string, askToken: string): Promise<boolean> {
  const { prisma } = await import('@/lib/db/prisma');
  const r = await resolveBookingRecipient(bookingId);
  if (!r) return false;
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { cleaner: { select: { name: true } } },
  });
  const { buildJobHappenedAsk } = await import('./email-templates');
  const { subject, html } = buildJobHappenedAsk({
    customerName: r.name,
    cleanerName: b?.cleaner?.name ?? 'your cleaner',
    serviceType: r.serviceType,
    date: r.date,
    askToken,
  });
  return sendEmail(r.email, subject, html);
}

/** Force-complete notice (ESSENTIAL, guest-safe). */
export async function sendForceCompleteNotice(
  bookingId: string,
  confirmedByCustomer: boolean
): Promise<boolean> {
  const r = await resolveBookingRecipient(bookingId);
  if (!r) return false;
  const { buildForceCompleteNotice } = await import('./email-templates');
  const { subject, html } = buildForceCompleteNotice({
    customerName: r.name,
    serviceType: r.serviceType,
    date: r.date,
    guestToken: r.guestToken,
    bookingId,
    confirmedByCustomer,
  });
  return sendEmail(r.email, subject, html);
}
