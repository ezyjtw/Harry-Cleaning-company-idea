import { Resend } from 'resend';

import {
  buildBookingConfirmation,
  buildBookingReminder,
  buildCleanerReminder,
  buildBookingCancellation,
  buildRefundConfirmation,
  buildCleanerAssignment,
  buildPasswordReset,
  buildEmailVerification,
  buildPaymentReceipt,
  buildContactConfirmation,
  buildSupportAlert,
  buildReviewRequest,
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
  }
): Promise<boolean> {
  const category = opts?.category ?? 'ESSENTIAL';
  const userId = opts?.userId ?? null;

  if (!(await shouldSend(userId, category, 'EMAIL'))) {
    // eslint-disable-next-line no-console
    console.log(`[Email] Suppressed by preference (category=${category}) to: ${to}`);
    return false;
  }

  if (process.env.NODE_ENV !== 'production' || !resend) {
    // eslint-disable-next-line no-console
    console.log('─────────────────────────────────────────');
    // eslint-disable-next-line no-console
    console.log(`[Email] To: ${to}`);
    // eslint-disable-next-line no-console
    console.log(`[Email] Subject: ${subject}`);
    // eslint-disable-next-line no-console
    console.log(`[Email] Body preview: ${htmlBody.substring(0, 200)}...`);
    // eslint-disable-next-line no-console
    console.log('─────────────────────────────────────────');
    return true;
  }

  try {
    await resend?.emails.send({
      from: FROM_WITH_NAME,
      to,
      subject,
      html: htmlBody,
      ...(opts?.headers ? { headers: opts.headers } : {}),
    });
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
  booking: BookingEmailData,
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
  return sendEmail(SUPPORT_EMAIL, subject, html);
}

// ─── Review Request Email ──────────────────────────────────

export async function sendReviewRequest(
  booking: BookingEmailData,
  user: UserEmailData,
  userId?: string | null
): Promise<boolean> {
  const { subject, html } = buildReviewRequest(booking, user);
  return sendEmail(user.email, subject, html, { userId: userId ?? null, category: 'REMINDER' });
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
