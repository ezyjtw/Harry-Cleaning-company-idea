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

// ─── Helper ─────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  // TODO: Integrate with a real SMTP provider (e.g., SendGrid, AWS SES, Postmark)

  if (process.env.NODE_ENV !== 'production') {
    console.log('─────────────────────────────────────────');
    console.log(`[Email] To: ${to}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] Body preview: ${htmlBody.substring(0, 200)}...`);
    console.log('─────────────────────────────────────────');
    return true;
  }

  // Production: send via SMTP
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ from, to, subject, html: htmlBody });
  console.log(`[Email] Would send email to ${to}: ${subject}`);
  return true;
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
      <li><strong>Total:</strong> £${booking.totalPrice.toFixed(2)}</li>
    </ul>
    <p>Your payment is held securely in escrow until the job is completed.</p>
    <p>Thank you for choosing Rena Cleaning Network!</p>
  `;

  console.log(`[Email] Sending booking confirmation to ${user.email}`);
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

  console.log(`[Email] Sending booking reminder to ${user.email}`);
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

  console.log(`[Email] Sending booking cancellation to ${user.email}`);
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

  console.log(`[Email] Sending cleaner assignment to ${cleaner.email}`);
  return sendEmail(cleaner.email, subject, htmlBody);
}

// ─── Account Emails ─────────────────────────────────────────

export async function sendPasswordReset(
  email: string,
  token: string
): Promise<boolean> {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const subject = 'Reset your password - Rena Cleaning Network';
  const htmlBody = `
    <h1>Reset your password</h1>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${resetLink}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  console.log(`[Email] Sending password reset to ${email}`);
  return sendEmail(email, subject, htmlBody);
}

export async function sendEmailVerification(
  email: string,
  token: string
): Promise<boolean> {
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify?token=${token}`;
  const subject = 'Verify your email - Rena Cleaning Network';
  const htmlBody = `
    <h1>Verify your email address</h1>
    <p>Welcome to Rena Cleaning Network! Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyLink}">Verify Email</a></p>
    <p>This link will expire in 24 hours.</p>
  `;

  console.log(`[Email] Sending email verification to ${email}`);
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
      <li><strong>Amount:</strong> £${payment.amount.toFixed(2)}</li>
      <li><strong>Date:</strong> ${payment.date}</li>
      <li><strong>Booking:</strong> #${payment.bookingId}</li>
      <li><strong>Method:</strong> ${payment.method}</li>
      <li><strong>Transaction ID:</strong> ${payment.id}</li>
    </ul>
    <p>Your payment is held securely in escrow and will be released to the cleaner once the job is completed.</p>
    <p>Thank you for using Rena Cleaning Network!</p>
  `;

  console.log(`[Email] Sending payment receipt to ${user.email}`);
  return sendEmail(user.email, subject, htmlBody);
}
