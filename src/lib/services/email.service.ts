import { Resend } from 'resend';

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

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
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
  user: UserEmailData
): Promise<boolean> {
  const subject = `Booking cancelled - ${booking.date}`;
  const htmlBody = `
    <h1>Booking cancelled</h1>
    <p>Hi ${user.name},</p>
    <p>Your booking on ${booking.date} at ${booking.time} has been cancelled.</p>
    <p>If you were charged, a full refund will be processed within 3-5 business days.</p>
    <p>We hope to see you again soon!</p>
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
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify?token=${token}`;
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

// ─── Guest Booking Email ────────────────────────────────────

export async function sendGuestBookingConfirmation(
  booking: BookingEmailData,
  email: string,
  guestName: string,
  guestToken: string
): Promise<boolean> {
  const manageLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/guest?token=${guestToken}`;
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
    <p>Thank you for choosing Rena Cleaning Network!</p>
  `;

  return sendEmail(email, subject, htmlBody);
}

// ─── Abandonment Email ──────────────────────────────────────

export async function sendAbandonmentEmail(
  email: string,
  data: { cleanerName?: string; postcode?: string; personalizedMessage: string }
): Promise<boolean> {
  const subject = data.cleanerName
    ? `Still looking for a cleaner? ${data.cleanerName} is available`
    : 'Complete your booking with Rena';
  const bookLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cleaners${data.postcode ? `?postcode=${data.postcode}` : ''}`;
  const htmlBody = `
    <p>${data.personalizedMessage}</p>
    <p><a href="${bookLink}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Complete Your Booking</a></p>
    <p style="font-size:12px;color:#999;">If you no longer wish to receive these emails, simply ignore this message.</p>
  `;

  return sendEmail(email, subject, htmlBody);
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
