/**
 * Generates email-preview.html — every email template rendered inside the E1
 * wrapper with realistic sample data, stacked with a labelled divider per
 * template. For visual review before merge; renders nothing to production.
 *
 * Usage:
 *   NEXT_PUBLIC_APP_URL=https://www.renacleaning.co.uk npx tsx scripts/generate-email-preview.ts
 *
 * Re-run any time the templates change to refresh the preview.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildBookingConfirmation,
  buildBookingReminder,
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
  buildAbandonmentEmail,
  buildVerificationDecision,
  buildTopupApprovalRequest,
  buildSignupNotification,
  buildPaymentFailureNotification,
  type EmailContent,
} from '../src/lib/services/email-templates';

const booking = {
  id: '10482',
  customerName: 'Sarah Thompson',
  cleanerName: 'Maria Santos',
  date: 'Monday 14 July 2025',
  time: '10:00 AM',
  address: '42 Larkfield Road, London E4 8QP',
  serviceType: 'Deep',
  totalPrice: 96,
};
const user = { name: 'Sarah Thompson', email: 'sarah@example.com' };
const cleaner = { name: 'Maria Santos', email: 'maria@example.com' };
const payment = {
  id: 'pi_3QxT7bK2eZ9aQwLc1',
  amount: 96,
  date: '14 July 2025',
  bookingId: '10482',
  method: 'Visa •••• 4242',
};
const unsubscribeUrl = 'https://www.renacleaning.co.uk/unsubscribe?token=sample-signed-token';

// [number label, EmailContent, optional reviewer note]
const sections: Array<[string, EmailContent, string?]> = [
  ['1/18 — bookingConfirmation', buildBookingConfirmation(booking, user)],
  ['2/18 — bookingReminder', buildBookingReminder(booking, user)],
  [
    '3/18 — bookingCancellation',
    buildBookingCancellation(booking, user, { refundAmount: 96, refundPercent: 100 }),
    'Shown with a full-refund sample; the refund sentence has 4 variants (full / partial / none / unknown) — all flow through the same paragraph slot.',
  ],
  ['4/18 — refundConfirmation', buildRefundConfirmation(booking, user, 96, true)],
  ['5/18 — cleanerAssignment', buildCleanerAssignment(booking, cleaner)],
  [
    '6/18 — passwordReset',
    buildPasswordReset('sample-token'),
    'Body copy still says "Click the link below"; the anchor is now rendered as the E1 button (copy unchanged, styling re-skinned).',
  ],
  ['7/18 — emailVerification', buildEmailVerification('sample-token')],
  ['8/18 — paymentReceipt', buildPaymentReceipt(payment, user)],
  [
    '9/18 — contactConfirmation',
    buildContactConfirmation('Sarah Thompson', 'Rescheduling my booking'),
  ],
  [
    '10/18 — supportAlert (internal)',
    buildSupportAlert({
      name: 'Sarah Thompson',
      email: 'sarah@example.com',
      phone: '+44 7700 900123',
      subject: 'Rescheduling my booking',
      message: 'Hi, can I move my Monday clean to Tuesday morning? Thanks!',
      bookingRef: 'BK-10482',
    }),
    'Internal alert to support; detail fields moved from a <ul> into the info-block.',
  ],
  ['11/18 — reviewRequest', buildReviewRequest(booking, user)],
  [
    '12/18 — newMessage',
    buildNewMessageEmail('Sarah Thompson', 'Maria Santos'),
    'Preference-governed (NEW_MESSAGE) → footer carries a "Manage email preferences" link to /account/notifications. This footer line is wrapper-added (the original had none).',
  ],
  [
    '13/18 — guestBookingConfirmation',
    buildGuestBookingConfirmation(booking, 'sarah@example.com', 'Sarah Thompson', 'guest-token'),
  ],
  [
    '14/18 — abandonment',
    buildAbandonmentEmail(
      {
        cleanerName: 'Maria Santos',
        postcode: 'E4',
        personalizedMessage:
          'You were looking at cleaners near E4 — Maria Santos and 4 others are available this week. Pick up where you left off?',
      },
      unsubscribeUrl
    ),
    'MARKETING → footer carries the PECR Unsubscribe link (same wording as before, moved into the wrapper footer).',
  ],
  [
    '15/18 — verificationDecision (approved)',
    buildVerificationDecision({ cleanerName: 'Maria Santos', approved: true }),
    'Single template, two bodies (approved + rejected). Approved keeps the two-CTA + hairline + muted-note structure.',
  ],
  [
    '15/18 — verificationDecision (rejected)',
    buildVerificationDecision({
      cleanerName: 'Maria Santos',
      approved: false,
      reason: 'DBS certificate could not be verified against the share code provided.',
    }),
  ],
  [
    '16/18 — topupApprovalRequest',
    buildTopupApprovalRequest({
      bookingId: '10482',
      customerName: 'Sarah Thompson',
      originalPrice: 96,
      newPrice: 112,
      topupAmount: 16,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    }),
  ],
  [
    '17/18 — signupNotification (internal)',
    buildSignupNotification({
      name: 'Maria Santos',
      email: 'maria@example.com',
      phone: '+44 7700 900010',
      role: 'CLEANER',
      createdAt: '14 July 2025, 09:12',
    }),
  ],
  [
    '18/18 — paymentFailureNotification',
    buildPaymentFailureNotification({
      bookingId: '10482',
      customerName: 'Sarah Thompson',
      reason: 'Your card was declined (insufficient funds).',
    }),
  ],
];

const blocks = sections
  .map(([label, email, note]) => {
    const noteHtml = note
      ? `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#b45309;">Note: ${note}</p>`
      : '';
    return `<div style="max-width:640px;margin:0 auto;">
      <div style="padding:18px 8px 8px;border-bottom:2px solid #16296b;margin-bottom:14px;">
        <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#16296b;">${label}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:2px;">Subject: ${email.subject}</div>
        ${noteHtml}
      </div>
    </div>
    ${email.html}`;
  })
  .join('\n<div style="height:36px;"></div>\n');

// Preview-only: the wordmark PNG isn't live at renacleaning.co.uk until this branch
// merges + deploys, so embed it as a data-URI HERE so James sees the real rendering
// now. The actual email templates keep the live URL (which resolves after deploy).
const liveLogoUrl = 'https://www.renacleaning.co.uk/icons/rena-wordmark-email.png';
const logoDataUri =
  'data:image/png;base64,' +
  readFileSync(join(process.cwd(), 'public/icons/rena-wordmark-email.png')).toString('base64');
const blocksWithLogo = blocks.split(liveLogoUrl).join(logoDataUri);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rena email templates — E1 preview (19)</title>
</head>
<body style="margin:0;background:#e9ebef;padding:24px 0;">
<div style="max-width:640px;margin:0 auto 8px;font-family:Arial,sans-serif;color:#1B2A4A;padding:0 8px;">
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:22px;margin:0 0 4px;">Rena email templates — E1 wrapper preview</h1>
  <p style="font-size:13px;color:#6b7280;margin:0 0 6px;">All 19 templates with sample data. Review each, then merge.</p>
  <p style="font-size:12px;color:#b45309;margin:0;">Note: the header wordmark is embedded as a data-URI in THIS preview only, so it renders now. The real emails reference https://www.renacleaning.co.uk/icons/rena-wordmark-email.png, which goes live after this branch deploys.</p>
</div>
<div style="height:20px;"></div>
${blocksWithLogo}
</body>
</html>`;

writeFileSync(join(process.cwd(), 'email-preview.html'), page, 'utf8');
// eslint-disable-next-line no-console
console.log(`Wrote email-preview.html with ${sections.length} rendered emails.`);
