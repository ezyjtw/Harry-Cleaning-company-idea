import { Resend } from 'resend';

import {
  shouldSend,
  type NotificationCategory,
} from '@/lib/services/notification-preferences.service';
import { generateUnsubscribeToken } from '@/lib/utils/unsubscribe-token';

// A11c: build the PECR unsubscribe footer + List-Unsubscribe headers for a
// marketing email to a known user. The header URL is the one-click POST endpoint
// (RFC 8058); the footer link is the friendly confirmation page.
function marketingUnsubscribe(
  userId: string,
  appUrl: string
): { footer: string; headers: Record<string, string> } {
  const token = generateUnsubscribeToken(userId);
  const pageUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  const oneClickUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  const footer = `<p style="font-size:12px;color:#999;">You're receiving this because you opted in to offers from Rena. <a href="${pageUrl}" style="color:#999;">Unsubscribe</a> at any time.</p>`;
  return {
    footer,
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// ─── Types ──────────────────────────────────────────────────

interface BookingEmailData {
  id: string;
  customerName: string;
  cleanerName?: string;
  date: string;
  time: string;
  address: string;
  serviceType: string;
  totalPrice: number;
}

interface UserEmailData {
  name: string;
  email: string;
}

interface CleanerEmailData {
  name: string;
  email: string;
}

interface PaymentEmailData {
  id: string;
  amount: number;
  date: string;
  bookingId: string;
  method: string;
}

// ─── Resend Client ──────────────────────────────────────────

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rena.com';

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
      from: FROM_EMAIL,
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
  const subject = `Booking confirmed - ${booking.date} at ${booking.time}`;
  const htmlBody = `
    <h1>Your booking is confirmed!</h1>
    <p>Hi ${user.name},</p>
    <p>Your ${booking.serviceType} cleaning has been confirmed.</p>
    <ul>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Address:</strong> ${booking.address}</li>
      <li><strong>Total:</strong> &pound;${booking.totalPrice.toFixed(2)}</li>
    </ul>
    <p>Your payment is held securely in escrow until the job is completed.</p>
    <p>Thank you for choosing Rena Cleaning Network!</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

export async function sendBookingReminder(
  booking: BookingEmailData,
  user: UserEmailData
): Promise<boolean> {
  const subject = `Reminder: Cleaning tomorrow at ${booking.time}`;
  const htmlBody = `
    <h1>Cleaning reminder</h1>
    <p>Hi ${user.name},</p>
    <p>This is a friendly reminder that you have a cleaning session tomorrow.</p>
    <ul>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Address:</strong> ${booking.address}</li>
      ${booking.cleanerName ? `<li><strong>Cleaner:</strong> ${booking.cleanerName}</li>` : ''}
    </ul>
    <p>Need to reschedule? Please let us know at least 4 hours in advance.</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

export async function sendBookingCancellation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundInfo?: { refundAmount: number; refundPercent: number }
): Promise<boolean> {
  const subject = `Booking cancelled - ${booking.date}`;

  let refundText: string;
  if (!refundInfo) {
    refundText = 'If you were charged, any refund due will be processed within 5-10 business days.';
  } else if (refundInfo.refundPercent >= 100) {
    refundText = `A full refund of &pound;${refundInfo.refundAmount.toFixed(2)} will be processed within 5-10 business days.`;
  } else if (refundInfo.refundPercent > 0) {
    refundText = `In line with our cancellation policy, a ${refundInfo.refundPercent}% refund of &pound;${refundInfo.refundAmount.toFixed(2)} will be processed within 5-10 business days.`;
  } else {
    refundText =
      'As this cancellation falls within 24 hours of the booking, no refund is due under our cancellation policy.';
  }

  const htmlBody = `
    <h1>Booking cancelled</h1>
    <p>Hi ${user.name},</p>
    <p>Your booking on ${booking.date} at ${booking.time} has been cancelled.</p>
    <p>${refundText}</p>
    <p>We hope to see you again soon!</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

export async function sendRefundConfirmation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundAmount: number,
  isFullRefund: boolean
): Promise<boolean> {
  const subject = isFullRefund
    ? `Full refund issued - ${booking.date}`
    : `Partial refund issued - ${booking.date}`;
  const htmlBody = `
    <h1>${isFullRefund ? 'Full Refund' : 'Partial Refund'} Issued</h1>
    <p>Hi ${user.name},</p>
    <p>A refund of <strong>&pound;${refundAmount.toFixed(2)}</strong> has been issued for your booking on ${booking.date} at ${booking.time}.</p>
    <p>The refund will appear in your account within 5-10 business days.</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

export async function sendCleanerAssignment(
  booking: BookingEmailData,
  cleaner: CleanerEmailData
): Promise<boolean> {
  const subject = `New cleaning assignment - ${booking.date} at ${booking.time}`;
  const htmlBody = `
    <h1>New assignment</h1>
    <p>Hi ${cleaner.name},</p>
    <p>You have been assigned a new ${booking.serviceType} cleaning job.</p>
    <ul>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Address:</strong> ${booking.address}</li>
      <li><strong>Customer:</strong> ${booking.customerName}</li>
    </ul>
    <p>Please confirm your availability as soon as possible.</p>
  `;

  return sendEmail(cleaner.email, subject, htmlBody);
}

// ─── Account Emails ─────────────────────────────────────────

export async function sendPasswordReset(email: string, token: string): Promise<boolean> {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const subject = 'Reset your password - Rena Cleaning Network';
  const htmlBody = `
    <h1>Reset your password</h1>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${resetLink}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  return sendEmail(email, subject, htmlBody);
}

export async function sendEmailVerification(email: string, token: string): Promise<boolean> {
  // A16b-2a: points at the real email-verification route (/verify is the DBS page).
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const subject = 'Verify your email - Rena Cleaning Network';
  const htmlBody = `
    <h1>Verify your email address</h1>
    <p>Welcome to Rena Cleaning Network! Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyLink}">Verify Email</a></p>
    <p>This link will expire in 24 hours.</p>
  `;

  return sendEmail(email, subject, htmlBody);
}

// ─── Payment Emails ─────────────────────────────────────────

export async function sendPaymentReceipt(
  payment: PaymentEmailData,
  user: UserEmailData
): Promise<boolean> {
  const subject = `Payment receipt - £${payment.amount.toFixed(2)}`;
  const htmlBody = `
    <h1>Payment receipt</h1>
    <p>Hi ${user.name},</p>
    <p>Your payment has been processed successfully.</p>
    <ul>
      <li><strong>Amount:</strong> &pound;${payment.amount.toFixed(2)}</li>
      <li><strong>Date:</strong> ${payment.date}</li>
      <li><strong>Booking:</strong> #${payment.bookingId}</li>
      <li><strong>Method:</strong> ${payment.method}</li>
      <li><strong>Transaction ID:</strong> ${payment.id}</li>
    </ul>
    <p>Your payment is held securely in escrow and will be released to the cleaner once the job is completed.</p>
    <p>Thank you for using Rena Cleaning Network!</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

// ─── Contact Emails ─────────────────────────────────────────

export async function sendContactConfirmation(
  email: string,
  name: string,
  subject: string
): Promise<boolean> {
  const htmlBody = `
    <h1>We received your message</h1>
    <p>Hi ${name},</p>
    <p>Thank you for contacting Rena Cleaning Network. We've received your enquiry regarding "<strong>${subject}</strong>".</p>
    <p>Our support team will get back to you within 24 hours.</p>
    <p>Best regards,<br/>The Rena Team</p>
  `;

  return sendEmail(email, 'We received your message - Rena', htmlBody);
}

export async function sendSupportAlert(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  bookingRef?: string;
}): Promise<boolean> {
  const htmlBody = `
    <h1>New Contact Form Submission</h1>
    <ul>
      <li><strong>Name:</strong> ${data.name}</li>
      <li><strong>Email:</strong> ${data.email}</li>
      ${data.phone ? `<li><strong>Phone:</strong> ${data.phone}</li>` : ''}
      <li><strong>Subject:</strong> ${data.subject}</li>
      ${data.bookingRef ? `<li><strong>Booking Ref:</strong> ${data.bookingRef}</li>` : ''}
    </ul>
    <h2>Message</h2>
    <p>${data.message}</p>
  `;

  return sendEmail(SUPPORT_EMAIL, `[Support] ${data.subject} - from ${data.name}`, htmlBody);
}

// ─── Review Request Email ──────────────────────────────────

export async function sendReviewRequest(
  booking: BookingEmailData,
  user: UserEmailData
): Promise<boolean> {
  const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?review=${booking.id}`;
  const subject = `How was your clean with ${booking.cleanerName}?`;
  const htmlBody = `
    <h1>How was your clean?</h1>
    <p>Hi ${user.name},</p>
    <p>Your ${booking.serviceType} clean with ${booking.cleanerName} on ${booking.date} has been completed.</p>
    <p>We'd love to hear how it went! Your review helps other customers find great cleaners.</p>
    <p><a href="${reviewLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Leave a Review</a></p>
    <p>Thank you for using Rena!</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
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
  const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/messages`;
  const subject = `New message from ${senderName}`;
  const htmlBody = `
    <h1>You have a new message</h1>
    <p>Hi ${recipientName || 'there'},</p>
    <p>${senderName} sent you a new message on Rena. Open the app to read it and reply.</p>
    <p>For your safety, please keep all conversation and payments on Rena — never share contact details or pay off-platform.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Read your message</a></p>
    <p>Thank you for using Rena!</p>
  `;

  // Toggleable: honour the recipient's new-message-alert preference.
  return sendEmail(recipientEmail, subject, htmlBody, {
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const manageLink = `${appUrl}/booking/guest?token=${guestToken}`;
  // A16b-3: guest→account conversion — messaging + reviews are account-only.
  const signupLink = `${appUrl}/signup?email=${encodeURIComponent(email)}`;
  const subject = `Booking confirmed - ${booking.date} at ${booking.time}`;
  const htmlBody = `
    <h1>Your booking is confirmed!</h1>
    <p>Hi ${guestName},</p>
    <p>Your ${booking.serviceType} cleaning has been confirmed.</p>
    <ul>
      <li><strong>Date:</strong> ${booking.date}</li>
      <li><strong>Time:</strong> ${booking.time}</li>
      <li><strong>Address:</strong> ${booking.address}</li>
      <li><strong>Total:</strong> &pound;${booking.totalPrice.toFixed(2)}</li>
    </ul>
    <p>You can manage your booking using this link:</p>
    <p><a href="${manageLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Manage Booking</a></p>
    <p>This link is personal to you — please don't share it.</p>
    <p>Want to message your cleaner or leave a review afterwards? <a href="${signupLink}">Create a free account</a> with this email — your booking will be linked to it automatically.</p>
    <p>Thank you for choosing Rena Cleaning Network!</p>
  `;

  return sendEmail(email, subject, htmlBody);
}

// ─── Abandonment Email ──────────────────────────────────────

export async function sendAbandonmentEmail(
  email: string,
  data: { cleanerName?: string; postcode?: string; personalizedMessage: string; userId?: string }
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const subject = data.cleanerName
    ? `Still looking for a cleaner? ${data.cleanerName} is available`
    : 'Complete your booking with Rena';
  const bookLink = `${appUrl}/cleaners${data.postcode ? `?postcode=${data.postcode}` : ''}`;

  // A11c (PECR): a real, working unsubscribe. Marketing only ever sends with a
  // userId (the gate suppresses consent-less sends), so we can always mint a
  // signed token. Footer link → friendly page; List-Unsubscribe header → one-click.
  const { footer, headers } = data.userId
    ? marketingUnsubscribe(data.userId, appUrl)
    : { footer: '', headers: undefined };

  const htmlBody = `
    <p>${data.personalizedMessage}</p>
    <p><a href="${bookLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Complete Your Booking</a></p>
    ${footer}
  `;

  // MARKETING (PECR): opt-in only. Suppressed unless the recipient has an explicit,
  // un-revoked marketing consent on record. Guest leads (no userId) have no consent
  // ⇒ suppressed by default.
  return sendEmail(email, subject, htmlBody, {
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (data.approved) {
    const subject = "You're verified — start receiving bookings on Rena";
    const htmlBody = `
      <h1>You&rsquo;re verified!</h1>
      <p>Hi ${data.cleanerName},</p>
      <p>Great news — your Rena application has been approved. You can now start receiving bookings from customers in your area.</p>
      <p><a href="${appUrl}/cleaner" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Go to your dashboard</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <h2 style="font-size:18px;margin:0 0 8px;">Connect your payment account</h2>
      <p>To start receiving bookings and payments, you need to connect your bank account securely via Stripe. This takes about 5 minutes.</p>
      <p><a href="${appUrl}/en/cleaner/stripe/connect" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Connect your payment account</a></p>
      <p style="font-size:13px;color:#6b7280;">This is required to receive payments. Note: your first payout will be held for 7&ndash;14 days as part of Stripe&rsquo;s verification process. After that, you&rsquo;ll be paid every Wednesday.</p>
      <p>Thank you for joining Rena Cleaning Network!</p>
    `;
    return sendEmail(data.cleanerEmail, subject, htmlBody);
  }

  const subject = 'Update on your Rena application';
  const htmlBody = `
    <h1>Application update</h1>
    <p>Hi ${data.cleanerName},</p>
    <p>Thank you for your interest in joining Rena Cleaning Network. Unfortunately, we were unable to approve your application at this time.</p>
    ${data.reason ? `<blockquote style="border-left:4px solid #d1d5db;padding:12px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:0 8px 8px 0;">&ldquo;${data.reason}&rdquo;</blockquote>` : ''}
    <p>If you have questions or believe this was made in error, please contact us at <a href="mailto:support@renacleaning.co.uk">support@renacleaning.co.uk</a>.</p>
    <p>Best regards,<br/>The Rena Team</p>
  `;
  return sendEmail(data.cleanerEmail, subject, htmlBody);
}

// ─── Top-Up Approval Request Email (A5.3) ─────────────────

export async function sendTopupApprovalRequest(data: {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  originalPrice: number;
  newPrice: number;
  topupAmount: number;
  expiresAt: Date;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const approvalLink = `${appUrl}/en/bookings/${data.bookingId}/approve-topup`;
  const hoursLeft = Math.max(
    1,
    Math.round((data.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))
  );
  const subject = `Action needed: price change for your booking`;
  const htmlBody = `
    <h1>Your booking price has changed</h1>
    <p>Hi ${data.customerName},</p>
    <p>Your original cleaner was unavailable, and a backup cleaner has been offered your booking at a different rate.</p>
    <ul>
      <li><strong>Original price:</strong> &pound;${data.originalPrice.toFixed(2)}</li>
      <li><strong>New price:</strong> &pound;${data.newPrice.toFixed(2)}</li>
      <li><strong>Extra to pay:</strong> &pound;${data.topupAmount.toFixed(2)}</li>
    </ul>
    <p>You have approximately <strong>${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong> to approve or decline.</p>
    <p><a href="${approvalLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Review &amp; Approve</a></p>
    <p>If you don't respond in time, we'll continue looking for another cleaner at your original price.</p>
    <p>Thank you,<br/>The Rena Team</p>
  `;

  return sendEmail(data.customerEmail, subject, htmlBody);
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

  const roleLabel = data.role === 'CLEANER' ? 'Cleaner' : 'Customer';
  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/users`;
  const subject = `New ${roleLabel} signup: ${data.name}`;
  const htmlBody = `
    <h1>New ${roleLabel} Signup</h1>
    <ul>
      <li><strong>Name:</strong> ${data.name}</li>
      <li><strong>Email:</strong> ${data.email}</li>
      ${data.phone ? `<li><strong>Phone:</strong> ${data.phone}</li>` : ''}
      <li><strong>Role:</strong> ${roleLabel}</li>
      <li><strong>Signed up:</strong> ${data.createdAt}</li>
    </ul>
    <p><a href="${adminUrl}">View in admin dashboard</a></p>
  `;

  return sendEmail(notificationEmail, subject, htmlBody);
}

// ─── Payment Failure Email ─────────────────────────────────

export async function sendPaymentFailureNotification(
  data: { bookingId: string; customerName: string; reason: string },
  user: UserEmailData
): Promise<boolean> {
  const retryLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/retry?id=${data.bookingId}`;
  const subject = 'Payment unsuccessful - action required';
  const htmlBody = `
    <h1>Payment unsuccessful</h1>
    <p>Hi ${data.customerName},</p>
    <p>Unfortunately, the payment for your booking <strong>#${data.bookingId}</strong> could not be processed.</p>
    <p><strong>Reason:</strong> ${data.reason}</p>
    <p>You can try again with a different payment method:</p>
    <p><a href="${retryLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Retry Payment</a></p>
    <p>If you continue to experience issues, please contact our support team.</p>
    <p>Best regards,<br/>The Rena Team</p>
  `;

  return sendEmail(user.email, subject, htmlBody);
}

// ─── Team Invite Email ──────────────────────────────────────

export async function sendTeamInvite(
  email: string,
  companyName: string,
  inviteToken: string
): Promise<boolean> {
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/company/join?token=${inviteToken}`;
  const subject = `You've been invited to join ${companyName} on Rena`;
  const htmlBody = `
    <h1>You've been invited!</h1>
    <p>${companyName} has invited you to join their team on Rena Cleaning Network.</p>
    <p><a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation</a></p>
    <p>This invitation will expire in 7 days.</p>
  `;

  return sendEmail(email, subject, htmlBody);
}
