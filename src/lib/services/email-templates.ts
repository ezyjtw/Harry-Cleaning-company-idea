// ─────────────────────────────────────────────────────────────
// Email templates — E1 "light minimal" shared wrapper + the 19 email bodies.
//
// PURE string builders (no prisma/resend/env-secret side effects) so the same
// code renders both the real sends (email.service.ts wraps each with sendEmail)
// and the static preview (scripts/generate-email-preview.ts). Copy is unchanged
// from the pre-wrapper templates — this is a re-skin, not a rewrite.
//
// Constraints: inline styles only, no custom fonts (Georgia serif headings /
// Arial body), absolute URLs for images + links, single column, table-based
// button so Outlook renders the click area, degrades sanely with images off.
// ─────────────────────────────────────────────────────────────

import { serviceLabelFromSlug } from '@/lib/constants/services';

// Absolute, production URLs (emails can't rely on relative paths or next/font).
const SITE_URL = 'https://www.renacleaning.co.uk';
// RENA wordmark rendered from the site's Etna brand font (scripts/generate-wordmark).
// Displayed at 120x38 (asset is 688x216 → ~5.7x retina). Goes live after deploy.
const LOGO_URL = `${SITE_URL}/icons/rena-wordmark-email.png`;
const SUPPORT_EMAIL = 'support@renacleaning.co.uk';

// Brand fonts first, then the exact web-safe fallbacks used before this sweep.
// Emails can't use next/font; clients that honour the linked webfont (see the
// <style> block in renderEmail — e.g. Apple Mail / iOS Mail) render
// Jost / Newsreader, every other client degrades to precisely today's
// Arial / Georgia. Zero-regression floor.
const FONT_BODY = 'font-family:Jost,Arial,Helvetica,sans-serif;';
const FONT_HEAD = "font-family:Newsreader,Georgia,'Times New Roman',serif;";

// Best-effort brand webfont for supporting clients. Rendered in the recipient's
// mail client (NOT under the site CSP), so the Google Fonts import is fine here.
// Non-supporting clients ignore it and fall back via FONT_HEAD / FONT_BODY.
const BRAND_FONT_LINK =
  "<style>@import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Newsreader:wght@500;600&display=swap');</style>";

export interface EmailContent {
  subject: string;
  html: string;
}

// ─── Shared types (used by builders + email.service.ts) ─────

export interface BookingEmailData {
  id: string;
  customerName: string;
  cleanerName?: string;
  date: string;
  time: string;
  address: string;
  serviceType: string;
  totalPrice: number;
  // F9: the confirmation email fires at PAYMENT time — before the offer is
  // answered — so its copy is state-honest ("offered", not "confirmed with").
  // These flags gate the reassurance clause to the booking's ACTUAL net.
  hasBackups?: boolean;
  autoAssignBackup?: boolean;
}

export interface UserEmailData {
  name: string;
  email: string;
}

export interface CleanerEmailData {
  name: string;
  email: string;
}

export interface PaymentEmailData {
  id: string;
  amount: number;
  date: string;
  bookingId: string;
  method: string;
}

// ─── Inline-style helpers ───────────────────────────────────

function h(text: string): string {
  return `<h1 style="${FONT_HEAD}font-size:20px;line-height:1.3;font-weight:normal;color:#1B2A4A;margin:0 0 14px;">${text}</h1>`;
}

function h2(text: string): string {
  return `<h2 style="${FONT_HEAD}font-size:16px;line-height:1.3;font-weight:normal;color:#1B2A4A;margin:20px 0 8px;">${text}</h2>`;
}

function p(html: string): string {
  return `<p style="${FONT_BODY}font-size:14px;line-height:1.6;color:#3D5170;margin:0 0 14px;">${html}</p>`;
}

function pMuted(html: string): string {
  return `<p style="${FONT_BODY}font-size:13px;line-height:1.6;color:#7A8A9E;margin:0 0 14px;">${html}</p>`;
}

function inlineLink(href: string, text: string): string {
  return `<a href="${href}" style="color:#16296b;text-decoration:underline;">${text}</a>`;
}

function hr(): string {
  return `<div style="border-top:1px solid #E4E9F0;line-height:1px;font-size:1px;margin:20px 0;">&nbsp;</div>`;
}

// Table-based button so the click area renders in Outlook (bgcolor on the cell,
// not CSS-only radius). 10px radius, #16296b, white bold text.
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;"><tr><td align="center" bgcolor="#16296b" style="border-radius:10px;"><a href="${href}" style="display:inline-block;padding:12px 28px;${FONT_BODY}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a></td></tr></table>`;
}

// Info block for booking details / amounts (bg #f7f8fb, 8px radius). Each row is
// a [label, value] pair; the value is emphasised in ink bold.
function infoBlock(rows: Array<[string, string]>): string {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr><td style="${FONT_BODY}font-size:13px;line-height:1.6;color:#3D5170;padding:3px 0;">${label}</td><td align="right" style="${FONT_BODY}font-size:13px;line-height:1.6;color:#1B2A4A;font-weight:bold;padding:3px 0;">${value}</td></tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fb;border-radius:8px;margin:0 0 16px;"><tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table></td></tr></table>`;
}

function blockquote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="border-left:4px solid #d1d5db;background:#f9fafb;border-radius:0 8px 8px 0;padding:12px 16px;${FONT_BODY}font-size:14px;line-height:1.6;color:#374151;">${text}</td></tr></table>`;
}

/** Footer utility link (blends with the muted footer). */
function footerLink(href: string, text: string): string {
  return `<a href="${href}" style="color:#7A8A9E;text-decoration:underline;">${text}</a>`;
}

// ─── The shared wrapper (E1 light minimal) ──────────────────

export function renderEmail(opts: { contentHtml: string; footerNote?: string }): string {
  const { contentHtml, footerNote } = opts;
  return `${BRAND_FONT_LINK}<div style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #E4E9F0;border-radius:10px;">
          <tr>
            <td align="center" style="padding:28px 32px 0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="120" height="38" alt="RENA" style="display:block;border:0;outline:none;width:120px;height:38px;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0;">
              <div style="border-top:1px solid #E4E9F0;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 6px;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 32px 28px;">
              <div style="border-top:1px solid #E4E9F0;padding-top:16px;">
                <p style="margin:0;${FONT_BODY}font-size:11px;line-height:1.6;color:#7A8A9E;text-align:center;">Rena Cleaning Network &middot; <a href="mailto:${SUPPORT_EMAIL}" style="color:#7A8A9E;text-decoration:underline;">${SUPPORT_EMAIL}</a><br/>66 Paul Street, London EC2A 4NA${footerNote ? `<br/>${footerNote}` : ''}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// ─── 19 template builders (copy byte-identical to pre-wrapper) ─

// B5: the cleaner's name leads the confirmation — the customer booked a
// person, not a slot. `cleanerName` may be the call site's "Your cleaner"
// fallback (Rena-Find bookings have no assignee at payment time), so the
// Cleaner row only renders for a real name.
function hasRealCleanerName(booking: BookingEmailData): boolean {
  return !!booking.cleanerName && booking.cleanerName !== 'Your cleaner';
}

// F9: the honest pending-offer line. The second clause names a net ONLY when
// one actually exists — no promising backups that aren't there.
function offerReassurance(booking: BookingEmailData): string {
  const net = booking.hasBackups
    ? ' &mdash; if they can&rsquo;t make it, your backup cleaners will step in'
    : booking.autoAssignBackup
      ? ' &mdash; if they can&rsquo;t make it, the Rena network will step in'
      : '';
  return `We&rsquo;ll confirm as soon as they accept${net}.`;
}

export function buildBookingConfirmation(
  booking: BookingEmailData,
  user: UserEmailData
): EmailContent {
  const subject = `Booking confirmed - ${booking.date} at ${booking.time}`;
  const named = hasRealCleanerName(booking);
  const rows: Array<[string, string]> = [];
  // F9: state-honest label — at payment time the cleaner is OFFERED, not booked.
  if (named) rows.push(['Offered to', booking.cleanerName as string]);
  rows.push(
    ['Date', booking.date],
    ['Time', booking.time],
    ['Address', booking.address],
    ['Total', `&pound;${booking.totalPrice.toFixed(2)}`]
  );
  const contentHtml =
    h('Your booking is confirmed!') +
    p(`Hi ${user.name},`) +
    p(
      named
        ? `Your ${serviceLabelFromSlug(booking.serviceType)} clean has been offered to <strong>${booking.cleanerName}</strong>. ${offerReassurance(booking)}`
        : `Your ${serviceLabelFromSlug(booking.serviceType)} clean is booked. We&rsquo;re matching you with a vetted cleaner and will confirm as soon as one accepts.`
    ) +
    infoBlock(rows) +
    p('Your payment is held securely until the job is completed.') +
    p('Thank you for choosing Rena Cleaning Network!');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildBookingReminder(booking: BookingEmailData, user: UserEmailData): EmailContent {
  const subject = 'Your cleaning is tomorrow';
  const rows: Array<[string, string]> = [
    ['Date', booking.date],
    ['Time', booking.time],
    ['Address', booking.address],
  ];
  if (booking.cleanerName) rows.push(['Cleaner', booking.cleanerName]);
  const contentHtml =
    h('Your cleaning is tomorrow') +
    p(`Hi ${user.name},`) +
    p('This is a friendly reminder that your Rena cleaning is booked for tomorrow.') +
    infoBlock(rows) +
    p(
      `Need to reschedule? You can manage your booking any time from ${inlineLink(`${appUrl()}/account/bookings`, 'your bookings')}, or let us know at least 4 hours in advance.`
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildCleanerReminder(
  booking: BookingEmailData,
  cleaner: CleanerEmailData
): EmailContent {
  const subject = 'You have a job tomorrow';
  const contentHtml =
    h('You have a job tomorrow') +
    p(`Hi ${cleaner.name},`) +
    p(
      `A reminder that you have a ${serviceLabelFromSlug(booking.serviceType)} cleaning job tomorrow.`
    ) +
    infoBlock([
      ['Date', booking.date],
      ['Time', booking.time],
      ['Address', booking.address],
      ['Customer', booking.customerName],
    ]) +
    p(
      `Please arrive on time. You can view the job in ${inlineLink(`${appUrl()}/dashboard`, 'your dashboard')}, and message the customer there if anything changes.`
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildBookingCancellation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundInfo?: { refundAmount: number; refundPercent: number }
): EmailContent {
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
  const contentHtml =
    h('Booking cancelled') +
    p(`Hi ${user.name},`) +
    p(`Your booking on ${booking.date} at ${booking.time} has been cancelled.`) +
    p(refundText) +
    p('We hope to see you again soon!');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildRefundConfirmation(
  booking: BookingEmailData,
  user: UserEmailData,
  refundAmount: number,
  isFullRefund: boolean
): EmailContent {
  const subject = isFullRefund
    ? `Full refund issued - ${booking.date}`
    : `Partial refund issued - ${booking.date}`;
  const contentHtml =
    h(`${isFullRefund ? 'Full Refund' : 'Partial Refund'} Issued`) +
    p(`Hi ${user.name},`) +
    p(
      `A refund of <strong>&pound;${refundAmount.toFixed(2)}</strong> has been issued for your booking on ${booking.date} at ${booking.time}.`
    ) +
    p('The refund will appear in your account within 5-10 business days.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// F1: the offer email. SANITISED BY LAW — this is a PRE-ACCEPT surface, so it
// carries area-level location only (H104 email law: no street address, no
// notes, no entry details ride in email). The Accept button deep-links to the
// job's home; the accept itself is the real authenticated atomicAccept there —
// logged-out cleaners go through login and return via callbackUrl. NO
// magic-token auto-accept, ever: a forwarded email must never let anyone
// accept as this cleaner.
export function buildCleanerAssignment(
  booking: BookingEmailData & { area: string; cleanerEarnings?: number },
  cleaner: CleanerEmailData
): EmailContent {
  const detailLink = `${appUrl()}/cleaner/jobs/${booking.id}`;
  const subject = `New job offer - ${booking.date} at ${booking.time}`;
  const contentHtml =
    h('New job offer') +
    p(`Hi ${cleaner.name},`) +
    p(`You&rsquo;ve been offered a ${serviceLabelFromSlug(booking.serviceType)} job.`) +
    infoBlock([
      ['Date', booking.date],
      ['Time', booking.time],
      ['Area', booking.area],
      // Net-first law: the cleaner's own figure, never the customer total.
      ...(booking.cleanerEarnings !== undefined
        ? ([['You&rsquo;d earn', `&pound;${booking.cleanerEarnings.toFixed(2)}`]] as [
            string,
            string,
          ][])
        : []),
    ]) +
    button(detailLink, 'Accept this job') +
    pMuted(
      'The full address and any customer notes are shown once you accept. Not signed in? The link takes you through login and straight back to this job.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

// F8: the cleaner's acceptance confirmation — rides with the .ics attachment.
// Sanitised body: net figure + link; entry details and notes live behind the
// authenticated detail page only.
export function buildCleanerJobAccepted(data: {
  cleanerName: string;
  serviceLabel: string;
  date: string;
  time: string;
  earnings: number;
  detailUrl: string;
}): EmailContent {
  const subject = `You're booked - ${data.date} at ${data.time}`;
  const contentHtml =
    h('Job confirmed — it&rsquo;s yours') +
    p(`Hi ${data.cleanerName},`) +
    p(
      `Your ${data.serviceLabel} on ${data.date} at ${data.time} is confirmed. ` +
        `You earn &pound;${data.earnings.toFixed(2)}.`
    ) +
    p('The attached calendar file adds it to your calendar with the address and timings.') +
    button(data.detailUrl, 'Open the job') +
    pMuted(
      'Entry details and customer notes are on the job page — kept there (not in this email or the calendar event) so they stay private to you.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-A: agreement-ended notice — no lock-in, either side can end. The AFFECTED
// party gets this email. Money honesty: SCHEDULED occurrences are unpaid by
// definition (Phase B charges at T-48h), so "nothing has been charged" is a
// structural truth, not a promise.
export function buildAgreementEnded(data: {
  recipientName: string;
  endedBy: 'CLEANER' | 'CUSTOMER';
  otherPartyName: string;
  serviceLabel: string;
  frequencyLabel: string; // 'weekly' | 'fortnightly'
}): EmailContent {
  if (data.endedBy === 'CLEANER') {
    // Cleaner ended → the customer hears it.
    const subject = 'Your regular clean has ended';
    const contentHtml =
      h('Your regular clean has ended') +
      p(`Hi ${data.recipientName},`) +
      p(
        `${data.otherPartyName} has ended your ${data.frequencyLabel} ${data.serviceLabel} arrangement. ` +
          'All upcoming scheduled cleans are cancelled and nothing has been charged for them.'
      ) +
      p(
        'Any clean that already happened is unaffected. If you&rsquo;d like to keep a regular clean going, you can book with another cleaner any time.'
      ) +
      button(`${appUrl()}/booking`, 'Book a clean');
    return { subject, html: renderEmail({ contentHtml }) };
  }
  // Customer ended → the cleaner hears it.
  const subject = 'A regular client has ended their arrangement';
  const contentHtml =
    h('Regular arrangement ended') +
    p(`Hi ${data.recipientName},`) +
    p(
      `${data.otherPartyName} has ended their ${data.frequencyLabel} ${data.serviceLabel} arrangement. ` +
        'Their upcoming scheduled cleans are cancelled and those slots are now free for other bookings.'
    ) +
    p('Any clean you&rsquo;ve already completed is unaffected — earnings from it stand as normal.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-B: the single-attempt failure email — James-ruled copy. The link is the
// normal ON-SESSION checkout for this occurrence (SCA handled natively there).
export function buildOccurrencePayNow(data: {
  customerName: string;
  cleanerName: string;
  dateLong: string; // e.g. "Tuesday 4 August"
  time: string;
  payUrl: string;
}): EmailContent {
  const subject = `We couldn't take payment for your clean on ${data.dateLong}`;
  const contentHtml =
    h('We couldn&rsquo;t take payment') +
    p(`Hi ${data.customerName},`) +
    p(
      `We couldn&rsquo;t take payment for your regular clean with ${data.cleanerName} on ${data.dateLong} at ${data.time} — pay now to keep your slot.`
    ) +
    button(data.payUrl, 'Pay now') +
    pMuted(
      `If it isn&rsquo;t paid by 24 hours before the clean, just this visit is cancelled — your regular arrangement carries on as normal.`
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-B: the T-24h auto-cancel email — honest, blame-free, and explicit that
// the standing arrangement survives (one missed payment kills one occurrence,
// never the schedule).
export function buildOccurrenceAutoCancelled(data: {
  customerName: string;
  cleanerName: string;
  dateLong: string;
}): EmailContent {
  const subject = `We couldn't confirm your clean this week`;
  const contentHtml =
    h('This week&rsquo;s clean is cancelled') +
    p(`Hi ${data.customerName},`) +
    p(
      `We couldn&rsquo;t confirm your clean with ${data.cleanerName} on ${data.dateLong} — payment didn&rsquo;t go through in time, so just this visit has been cancelled. You have not been charged for it.`
    ) +
    p(
      `<strong>Your regular slot is unaffected.</strong> Your next scheduled clean will be confirmed as normal.`
    ) +
    pMuted(
      'If your card details have changed, your next clean&rsquo;s payment email will let you pay with a new card.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-B race fix (James-ruled copy): payment landed just as the T-24h sweep
// cancelled the visit — full automatic refund, honestly explained.
export function buildOccurrenceLatePaymentRefunded(data: {
  customerName: string;
  cleanerName: string;
  dateLong: string;
  amount: number;
}): EmailContent {
  const subject = `Refunded in full — your clean on ${data.dateLong}`;
  const contentHtml =
    h('Refunded in full') +
    p(`Hi ${data.customerName},`) +
    p(
      `Your payment of &pound;${data.amount.toFixed(2)} for the clean with ${data.cleanerName} on ${data.dateLong} went through just as this visit was being cancelled — we&rsquo;ve refunded it in full. <strong>Your regular slot is unaffected.</strong>`
    ) +
    p('The refund will appear in your account within 5-10 business days.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-C: unpaid occurrence can't-make-it — the no-charge variant of the rescue
// email. Choices are reschedule or skip; nothing has been charged.
export function buildOccurrenceCantMake(data: {
  customerName: string;
  cleanerName: string;
  dateLong: string;
  time: string;
  chooseUrl: string;
}): EmailContent {
  const subject = `${data.cleanerName} can't make your clean on ${data.dateLong}`;
  const contentHtml =
    h('One clean needs a new plan') +
    p(`Hi ${data.customerName},`) +
    p(
      `${data.cleanerName} can&rsquo;t make your regular clean on ${data.dateLong} at ${data.time}. Nothing has been charged for it, and your regular arrangement is unaffected.`
    ) +
    p('Pick a new date with them, or skip this one — it&rsquo;s your choice.') +
    button(data.chooseUrl, 'Choose what happens') +
    pMuted(
      'If you don&rsquo;t choose in time, this one visit is simply skipped — nothing is charged and your next clean goes ahead as normal.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-C: holiday batch — one honest email per customer covering ALL their
// affected cleans in the range.
export function buildHolidayBatch(data: {
  customerName: string;
  cleanerName: string;
  startLong: string;
  endLong: string;
  count: number;
  cleans: Array<{ dateLong: string; time: string; paid: boolean }>;
  chooseUrl: string;
}): EmailContent {
  const plural = data.count > 1;
  const subject = `${data.cleanerName} is away ${data.startLong} – ${data.endLong}`;
  const rows = data.cleans.map((c) => [
    `${c.dateLong} at ${c.time}`,
    c.paid ? 'paid — full refund if you skip' : 'not yet charged',
  ]) as [string, string][];
  const contentHtml =
    h(`${data.cleanerName} is away`) +
    p(`Hi ${data.customerName},`) +
    p(
      `${data.cleanerName} is away ${data.startLong} &ndash; ${data.endLong} — choose for your ${data.count} affected clean${plural ? 's' : ''}. Your regular arrangement is unaffected.`
    ) +
    infoBlock(rows) +
    p(
      `For each clean you can pick a new date${plural ? '' : ' with them'}, choose cover, or skip it — paid cleans are refunded in full if you skip.`
    ) +
    button(data.chooseUrl, plural ? 'Choose for each clean' : 'Choose what happens') +
    pMuted(
      'Anything you don&rsquo;t decide in time resolves safely on its own: paid cleans are refunded in full, uncharged ones are simply skipped.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildPasswordReset(token: string): EmailContent {
  const resetLink = `${appUrl()}/reset-password?token=${token}`;
  const subject = 'Reset your password - Rena Cleaning Network';
  const contentHtml =
    h('Reset your password') +
    p('You requested a password reset. Click the link below to set a new password:') +
    button(resetLink, 'Reset Password') +
    p('This link will expire in 1 hour.') +
    p('If you did not request this, you can safely ignore this email.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// H99 ①: welcome-framed verify email at cleaner ACCOUNT CREATION (step 0 of
// the wizard) — copy James-approved. Verification gates nothing inside the
// wizard; abandoners stay contactable.
export function buildCleanerWelcome(token: string, firstName: string): EmailContent {
  const verifyLink = `${appUrl()}/api/auth/verify-email?token=${token}`;
  const subject = 'Welcome to Rena — verify your email';
  const contentHtml =
    h('Welcome to Rena Cleaning Network!') +
    p(`Hi ${firstName},`) +
    p(
      'Your account is set up — one quick step: confirm this email address so job updates and payout messages reach you.'
    ) +
    button(verifyLink, 'Verify my email') +
    pMuted(
      'Verifying never blocks your application — you can finish it any time, and we&rsquo;ll keep your progress safe.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildEmailVerification(token: string): EmailContent {
  // H95: the link must hit the CONSUMING route (/api/auth/verify-email), which
  // verifies and 303s to the friendly page with a status. It previously
  // pointed at the page itself, which ignores ?token= — so every verification
  // link ever sent landed on "Link no longer valid" without being consumed.
  const verifyLink = `${appUrl()}/api/auth/verify-email?token=${token}`;
  const subject = 'Verify your email - Rena Cleaning Network';
  const contentHtml =
    h('Verify your email address') +
    p(
      'Welcome to Rena Cleaning Network! Please verify your email address by clicking the link below:'
    ) +
    button(verifyLink, 'Verify Email') +
    p('This link will expire in 24 hours.');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildPaymentReceipt(payment: PaymentEmailData, user: UserEmailData): EmailContent {
  const subject = `Payment receipt - £${payment.amount.toFixed(2)}`;
  const contentHtml =
    h('Payment receipt') +
    p(`Hi ${user.name},`) +
    p('Your payment has been processed successfully.') +
    infoBlock([
      ['Amount', `&pound;${payment.amount.toFixed(2)}`],
      ['Date', payment.date],
      ['Booking', `#${payment.bookingId}`],
      ['Method', payment.method],
      ['Transaction ID', payment.id],
    ]) +
    p(
      'Your payment is held securely and will be released to the cleaner once the job is completed.'
    ) +
    p('Thank you for using Rena Cleaning Network!');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildContactConfirmation(name: string, subject: string): EmailContent {
  const contentHtml =
    h('We received your message') +
    p(`Hi ${name},`) +
    p(
      `Thank you for contacting Rena Cleaning Network. We've received your enquiry regarding "<strong>${subject}</strong>".`
    ) +
    p('Our support team will get back to you within 24 hours.') +
    p('Best regards,<br/>The Rena Team');
  return { subject: 'We received your message - Rena', html: renderEmail({ contentHtml }) };
}

export function buildSupportAlert(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  bookingRef?: string;
}): EmailContent {
  const rows: Array<[string, string]> = [
    ['Name', data.name],
    ['Email', data.email],
  ];
  if (data.phone) rows.push(['Phone', data.phone]);
  rows.push(['Subject', data.subject]);
  if (data.bookingRef) rows.push(['Booking Ref', data.bookingRef]);
  const contentHtml =
    h('New Contact Form Submission') + infoBlock(rows) + h2('Message') + p(data.message);
  return {
    subject: `[Support] ${data.subject} - from ${data.name}`,
    html: renderEmail({ contentHtml }),
  };
}

// H43: the assigned cleaner learns a customer reported a problem — bell AND
// email. Their payout is paused; the case link takes them to add their side.
// H64: the display reference customers and cleaners quote — first 8 chars,
// uppercased (matches the bookings list / admin cards), and the dispute form
// accepts exactly this format.
export function bookingDisplayRef(bookingId: string): string {
  return bookingId.substring(0, 8).toUpperCase();
}

export function buildDisputeOpenedCleaner(opts: {
  cleanerName: string;
  dateStr: string;
  reasonLabel: string;
  /** H64: traceability — every dispute email carries the booking reference. */
  bookingId?: string;
}): EmailContent {
  const link = `${appUrl()}/disputes`;
  const subject = opts.bookingId
    ? `A problem was reported on booking ${bookingDisplayRef(opts.bookingId)}`
    : 'A problem was reported on one of your bookings';
  const contentHtml =
    h('A problem was reported') +
    p(`Hi ${opts.cleanerName || 'there'},`) +
    p(
      `A customer has reported a problem with your booking on ${opts.dateStr} (${opts.reasonLabel}). While our team reviews it, your payout for this booking is on hold.`
    ) +
    (opts.bookingId
      ? p(`Booking reference: <strong>${bookingDisplayRef(opts.bookingId)}</strong>`)
      : '') +
    p(
      'You can add your side of the story and any photos on your disputes page. Stronger evidence helps us resolve things faster and fairly.'
    ) +
    button(link, 'View the dispute') +
    p('Thank you for using Rena.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// H62 (the rule): EVERY dispute resolution emails BOTH parties — the outcome,
// what happens to the money, and when. A refund additionally gets the standard
// refund confirmation (amount + timeline) via buildRefundConfirmation.
export function buildDisputeResolvedEmail(opts: {
  audience: 'customer' | 'cleaner';
  name: string;
  dateStr: string;
  outcome: 'release-to-cleaner' | 'refund-customer' | 'split';
  refundAmount?: number;
  /** The refund attempt failed (stuck-money retry queue) — promise, don't confirm. */
  refundPending?: boolean;
  /** H64: traceability — every dispute email carries the booking reference. */
  bookingId?: string;
  /** H69: guests get their tokened case view, not the login-walled /disputes. */
  caseUrl?: string;
}): EmailContent {
  const subject = opts.bookingId
    ? `Your dispute has been resolved — booking ${bookingDisplayRef(opts.bookingId)}`
    : 'Your dispute has been resolved';
  const link = opts.caseUrl ?? `${appUrl()}/disputes`;
  const amount = opts.refundAmount ?? 0;

  let moneyHtml: string;
  if (opts.audience === 'customer') {
    if (opts.outcome === 'refund-customer') {
      moneyHtml = opts.refundPending
        ? p(
            `A full refund of <strong>&pound;${amount.toFixed(2)}</strong> has been approved and is being processed. We'll email you confirmation as soon as it's issued.`
          )
        : p(
            `A full refund of <strong>&pound;${amount.toFixed(2)}</strong> has been issued. It will appear in your account within 5-10 business days.`
          );
    } else if (opts.outcome === 'split') {
      moneyHtml = opts.refundPending
        ? p(
            `A partial refund of <strong>&pound;${amount.toFixed(2)}</strong> has been approved and is being processed. We'll email you confirmation as soon as it's issued. The remainder of the payment goes to your cleaner.`
          )
        : p(
            `A partial refund of <strong>&pound;${amount.toFixed(2)}</strong> has been issued and will appear in your account within 5-10 business days. The remainder of the payment goes to your cleaner.`
          );
    } else {
      moneyHtml = p(
        'No refund has been issued — after review, the payment goes to your cleaner as normal. No further money will leave your account for this booking.'
      );
    }
  } else {
    if (opts.outcome === 'refund-customer') {
      moneyHtml = p(
        'The customer has been refunded in full, so no payment will be released to you for this booking.'
      );
    } else if (opts.outcome === 'split') {
      moneyHtml = p(
        `The customer received a partial refund of &pound;${amount.toFixed(2)}; your reduced payment for this booking is being released now and follows your normal payout schedule.`
      );
    } else {
      moneyHtml = p(
        'The dispute was resolved in your favour — your full payment for this booking is being released now and follows your normal payout schedule.'
      );
    }
  }

  const contentHtml =
    h('Dispute resolved') +
    p(`Hi ${opts.name || 'there'},`) +
    p(`Our team has finished reviewing the problem reported on the booking of ${opts.dateStr}.`) +
    moneyHtml +
    button(link, 'View the case') +
    p('Thank you for your patience while we looked into this.');
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-A (amended): the post-completion regular-clean offer, carried by the
// completion emails. usualSlot is the slot the customer just had, when opened.
export interface RegularOfferEmailSection {
  cleanerName: string;
  usualSlot: { dayOfWeek: number; start: string; end: string } | null;
  ctaUrl: string;
}

const OFFER_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function regularOfferHtml(offer: RegularOfferEmailSection): string {
  const slotLine = offer.usualSlot
    ? `your ${OFFER_DAY_NAMES[offer.usualSlot.dayOfWeek]} ${offer.usualSlot.start} slot is open`
    : 'they have slots open';
  return (
    p(
      `<strong>Loved your clean with ${offer.cleanerName}?</strong> Make it regular — ${slotLine} for weekly or fortnightly cleans. No lock-in: you can end it any time.`
    ) + button(offer.ctaUrl, 'Set up a regular clean')
  );
}

export function buildReviewRequest(
  booking: BookingEmailData,
  user: UserEmailData,
  offer?: RegularOfferEmailSection
): EmailContent {
  // H72: /dashboard is a redirect junction that DROPS the query string — the old
  // link landed on /account with the review context gone. Deep-link the bookings
  // page, which opens the review form for this booking.
  const reviewLink = `${appUrl()}/account/bookings?review=${booking.id}`;
  const subject = `How was your clean with ${booking.cleanerName}?`;
  const contentHtml =
    h('How was your clean?') +
    p(`Hi ${user.name},`) +
    p(
      `Your ${serviceLabelFromSlug(booking.serviceType)} clean with ${booking.cleanerName} on ${booking.date} has been completed.`
    ) +
    p("We'd love to hear how it went! Your review helps other customers find great cleaners.") +
    button(reviewLink, 'Leave a Review') +
    // R1-A (amended): the offer rides the completion email only when eligible —
    // never a dead-end CTA.
    (offer ? regularOfferHtml(offer) : '') +
    p('Thank you for using Rena!');
  return { subject, html: renderEmail({ contentHtml }) };
}

// R1-A (amended): the guest completion email — offer only (guest reviews are a
// parked ruling, so there is no review ask here). The CTA carries the guest's
// tokened link; the token is their identity on the setup page.
export function buildGuestCompletionOffer(data: {
  guestName: string;
  cleanerName: string;
  usualSlot: { dayOfWeek: number; start: string; end: string } | null;
  ctaUrl: string;
}): EmailContent {
  const subject = `Make your clean with ${data.cleanerName} a regular thing?`;
  const slotLine = data.usualSlot
    ? `your ${OFFER_DAY_NAMES[data.usualSlot.dayOfWeek]} ${data.usualSlot.start} slot is open`
    : 'they have slots open';
  const contentHtml =
    h('Loved your clean?') +
    p(`Hi ${data.guestName},`) +
    p(
      `Your clean with ${data.cleanerName} is complete. If you&rsquo;d like to make it regular, ${slotLine} for weekly or fortnightly cleans — same cleaner, same standard, no lock-in.`
    ) +
    button(data.ctaUrl, 'Set up a regular clean') +
    pMuted('You can end a regular arrangement at any time — nothing is charged beyond each clean.');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildNewMessageEmail(recipientName: string, senderName: string): EmailContent {
  const link = `${appUrl()}/messages`;
  const prefsUrl = `${appUrl()}/account/notifications`;
  const subject = `New message from ${senderName}`;
  const contentHtml =
    h('You have a new message') +
    p(`Hi ${recipientName || 'there'},`) +
    p(`${senderName} sent you a new message on Rena. Open the app to read it and reply.`) +
    p(
      'For your safety, please keep all conversation and payments on Rena. Never share contact details or pay off-platform.'
    ) +
    button(link, 'Read your message') +
    p('Thank you for using Rena!');
  const footerNote = `You're receiving this because message notifications are on. ${footerLink(prefsUrl, 'Manage email preferences')}.`;
  return { subject, html: renderEmail({ contentHtml, footerNote }) };
}

export function buildGuestBookingConfirmation(
  booking: BookingEmailData,
  email: string,
  guestName: string,
  guestToken: string,
  // H6: when this email address already belongs to a Rena account, the
  // create-account CTA is a misfire ("create an account" to an existing
  // customer). They get the useful equivalent instead: sign in and the booking
  // appears in their account (claim-on-login, A16b-2b).
  hasAccount = false
): EmailContent {
  const base = appUrl();
  const manageLink = `${base}/booking/guest?token=${guestToken}`;
  const signupLink = `${base}/signup?email=${encodeURIComponent(email)}`;
  const signinLink = `${base}/login?callbackUrl=${encodeURIComponent('/account/bookings')}`;
  const accountFooter = hasAccount
    ? `This email address already has a Rena account &mdash; ${inlineLink(signinLink, 'sign in')} and this booking will appear in your account automatically.`
    : `Want to message your cleaner or leave a review afterwards? ${inlineLink(signupLink, 'Create a free account')} with this email and your booking will be linked to it automatically.`;
  const subject = `Booking confirmed - ${booking.date} at ${booking.time}`;
  // B5: name the cleaner (guest parity with the account-holder confirmation).
  const named = hasRealCleanerName(booking);
  const rows: Array<[string, string]> = [];
  // F9: guest parity — same state-honest label as the account email.
  if (named) rows.push(['Offered to', booking.cleanerName as string]);
  rows.push(
    ['Date', booking.date],
    ['Time', booking.time],
    ['Address', booking.address],
    ['Total', `&pound;${booking.totalPrice.toFixed(2)}`]
  );
  const contentHtml =
    h('Your booking is confirmed!') +
    p(`Hi ${guestName},`) +
    p(
      named
        ? `Your ${serviceLabelFromSlug(booking.serviceType)} clean has been offered to <strong>${booking.cleanerName}</strong>. ${offerReassurance(booking)}`
        : `Your ${serviceLabelFromSlug(booking.serviceType)} clean is booked. We&rsquo;re matching you with a vetted cleaner and will confirm as soon as one accepts.`
    ) +
    infoBlock(rows) +
    p('You can manage your booking using this link:') +
    button(manageLink, 'Manage Booking') +
    p("This link is personal to you, so please don't share it.") +
    p(accountFooter) +
    p('Thank you for choosing Rena Cleaning Network!');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildGuestBookingReminder(
  booking: BookingEmailData,
  guestName: string,
  guestToken: string
): EmailContent {
  const manageLink = `${appUrl()}/booking/guest?token=${guestToken}`;
  const subject = 'Your cleaning is tomorrow';
  const rows: Array<[string, string]> = [
    ['Date', booking.date],
    ['Time', booking.time],
    ['Address', booking.address],
  ];
  if (booking.cleanerName) rows.push(['Cleaner', booking.cleanerName]);
  const contentHtml =
    h('Your cleaning is tomorrow') +
    p(`Hi ${guestName},`) +
    p('This is a friendly reminder that your Rena cleaning is booked for tomorrow.') +
    infoBlock(rows) +
    p('You can view, reschedule, or cancel your booking here:') +
    button(manageLink, 'Manage Booking') +
    p("This link is personal to you, so please don't share it.");
  // Transactional service message for a booking the guest placed (not marketing).
  // The manage-booking link above is the opt-out: cancelling stops any further
  // reminders. Footer states why they received it, per PECR good practice.
  const footerNote = `You're receiving this because you booked a cleaning with Rena. Manage or cancel your booking with the link above.`;
  return { subject, html: renderEmail({ contentHtml, footerNote }) };
}

export function buildAbandonmentEmail(
  data: { cleanerName?: string; postcode?: string; personalizedMessage: string },
  unsubscribeUrl?: string
): EmailContent {
  const base = appUrl();
  const subject = data.cleanerName
    ? `Still looking for a cleaner? ${data.cleanerName} is available`
    : 'Complete your booking with Rena';
  const bookLink = `${base}/cleaners${data.postcode ? `?postcode=${data.postcode}` : ''}`;
  const contentHtml = p(data.personalizedMessage) + button(bookLink, 'Complete Your Booking');
  const footerNote = unsubscribeUrl
    ? `You're receiving this because you opted in to offers from Rena. ${footerLink(unsubscribeUrl, 'Unsubscribe')} at any time.`
    : undefined;
  return { subject, html: renderEmail({ contentHtml, footerNote }) };
}

export function buildVerificationDecision(data: {
  cleanerName: string;
  approved: boolean;
  reason?: string;
}): EmailContent {
  const base = appUrl();
  if (data.approved) {
    // Two-stage flow: identity verification is NOT go-live. This email must
    // never claim bookings are flowing — that's buildGoLive's moment.
    const subject = 'Identity verified — two steps to go live on Rena';
    const contentHtml =
      h('Your identity is verified!') +
      p(`Hi ${data.cleanerName},`) +
      p(
        'Great news: we&rsquo;ve verified your identity and right to work. Two quick steps remain before you go live and start receiving bookings: connect your payouts and upload your public liability insurance. You can do them in any order.'
      ) +
      button(`${base}/cleaner`, 'Go to your dashboard') +
      hr() +
      h2('Connect your payment account') +
      p(
        'To start receiving bookings and payments, you need to connect your bank account securely via Stripe. This takes about 5 minutes.'
      ) +
      button(`${base}/en/cleaner/stripe/connect`, 'Connect your payment account') +
      pMuted(
        'This is required to receive payments. After each completed job your funds are released within 24 hours (often instantly once your customer confirms), then paid to your bank on Stripe&rsquo;s schedule. Your first payout takes a little longer &mdash; around 7 days while Stripe verifies your account &mdash; and it&rsquo;s faster after that.'
      ) +
      p('Thank you for joining Rena Cleaning Network!');
    return { subject, html: renderEmail({ contentHtml }) };
  }
  const subject = 'Update on your Rena application';
  const contentHtml =
    h('Application update') +
    p(`Hi ${data.cleanerName},`) +
    p(
      'Thank you for your interest in joining Rena Cleaning Network. Unfortunately, we were unable to approve your application at this time.'
    ) +
    (data.reason ? blockquote(`&ldquo;${data.reason}&rdquo;`) : '') +
    p(
      `If you have questions or believe this was made in error, please contact us at ${inlineLink('mailto:support@renacleaning.co.uk', 'support@renacleaning.co.uk')}.`
    ) +
    p('Best regards,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

// Two-stage flow: the go-live celebration — sent exactly once by
// maybeMarkLive() when identity + insurance + Stripe are ALL green.
export function buildGoLive(data: { name: string }): EmailContent {
  const base = appUrl();
  const subject = "You're live on Rena — customers can now book you";
  const contentHtml =
    h('You&rsquo;re live!') +
    p(`Hi ${data.name},`) +
    p(
      'Everything checks out: identity verified, insurance approved, and payouts connected. Your profile is now visible to customers in your area and you can start receiving bookings.'
    ) +
    button(`${base}/cleaner`, 'Open your dashboard') +
    p(
      'Keep your availability up to date so offers reach you at the right times, and respond quickly to your first offers to build your rating early.'
    ) +
    p('Welcome aboard — go get that first booking.');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildTopupApprovalRequest(data: {
  bookingId: string;
  customerName: string;
  originalPrice: number;
  newPrice: number;
  topupAmount: number;
  expiresAt: Date;
  guestToken?: string | null; // F5: guests approve via their capability token
}): EmailContent {
  // Path fix: the approval page lives at /booking/[id]/approve-topup — the old
  // link ("/en/bookings/…") 404'd for every registered customer.
  const approvalLink = data.guestToken
    ? `${appUrl()}/booking/${data.bookingId}/approve-topup?token=${encodeURIComponent(data.guestToken)}`
    : `${appUrl()}/booking/${data.bookingId}/approve-topup`;
  const hoursLeft = Math.max(
    1,
    Math.round((data.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))
  );
  const subject = `Action needed: price change for your booking`;
  const contentHtml =
    h('Your booking price has changed') +
    p(`Hi ${data.customerName},`) +
    p(
      'Your original cleaner was unavailable, and a backup cleaner has been offered your booking at a different rate.'
    ) +
    infoBlock([
      ['Original price', `&pound;${data.originalPrice.toFixed(2)}`],
      ['New price', `&pound;${data.newPrice.toFixed(2)}`],
      ['Extra to pay', `&pound;${data.topupAmount.toFixed(2)}`],
    ]) +
    p(
      `You have approximately <strong>${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong> to approve or decline.`
    ) +
    button(approvalLink, 'Review &amp; Approve') +
    p(
      "If you don't respond in time, we'll continue looking for another cleaner at your original price."
    ) +
    p('Thank you,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

// ─── M3 rescue: cleaner cancelled — customer chooses refund or rebook ────────

export function buildCleanerCancelledRescue(data: {
  bookingId: string;
  customerName: string;
  guestToken: string | null; // null => registered customer
  serviceType: string;
  date: Date;
  startTime: string;
  deadline: Date;
}): EmailContent {
  // Both choices are made ON the booking page — registered customers land on
  // /booking/[id]; guests land on the tokened tracking page (the F5 pattern:
  // every link a guest receives must carry their token, end to end).
  const base = data.guestToken
    ? `${appUrl()}/booking/guest?token=${encodeURIComponent(data.guestToken)}`
    : `${appUrl()}/booking/${data.bookingId}`;
  const sep = data.guestToken ? '&' : '?';
  const refundLink = `${base}${sep}rescue=refund`;
  const rebookLink = `${base}${sep}rescue=rebook`;

  const hoursLeft = Math.max(1, Math.round((data.deadline.getTime() - Date.now()) / 3_600_000));
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const subject = 'Your cleaner has had to cancel — your payment is safe';
  const contentHtml =
    h('Your cleaner has had to cancel') +
    p(`Hi ${data.customerName},`) +
    p(
      `We're really sorry — your cleaner has had to cancel your ${serviceLabelFromSlug(data.serviceType)} booking on <strong>${dateStr} at ${data.startTime}</strong>. We know how inconvenient this is.`
    ) +
    p('<strong>Your payment is completely safe.</strong> You choose what happens next:') +
    button(rebookLink, 'Help me rebook') +
    p(
      'We&rsquo;ll show you cleaners who are genuinely available &mdash; your details are already filled in, and the money you&rsquo;ve paid simply moves to the new booking. If the new cleaner costs less, we refund the difference automatically; if more, we&rsquo;ll ask before charging a penny.'
    ) +
    button(refundLink, 'Refund me in full') +
    p('One tap, and the full amount goes back to your original payment method.') +
    p(
      `If we don&rsquo;t hear from you within <strong>${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong> (or by the booking&rsquo;s start time), we&rsquo;ll automatically refund you in full &mdash; you won&rsquo;t lose a penny either way.`
    ) +
    p('Again, we&rsquo;re sorry for the disruption.<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

// ─── H15: acceptance moment — the customer learns WHO took their clean ───────
//
// Sent on EVERY acceptance path (direct, backup, Rena-Find, rescue-①, rebook)
// via the atomic accept functions. Transactional/ESSENTIAL — it's the news the
// customer is waiting for, so it is never quiet-hours gated or preference
// suppressed.

export function buildCleanerAcceptedBooking(data: {
  bookingId: string;
  customerName: string;
  cleanerName: string;
  serviceType: string;
  date: Date;
  startTime: string;
  guestToken?: string | null;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const link = data.guestToken
    ? `${appUrl()}/booking/guest?token=${encodeURIComponent(data.guestToken)}`
    : `${appUrl()}/booking/${data.bookingId}`;
  const subject = `Good news — ${data.cleanerName} has taken your ${serviceLabelFromSlug(data.serviceType).toLowerCase()}`;
  const contentHtml =
    h('Good news &mdash; your cleaner is confirmed') +
    p(`Hi ${data.customerName},`) +
    p(
      `<strong>${data.cleanerName}</strong> has taken your ${serviceLabelFromSlug(data.serviceType)} on <strong>${dateStr} at ${data.startTime}</strong>. You're all set &mdash; nothing more to do.`
    ) +
    button(link, 'View your booking') +
    p('Thank you for choosing Rena Cleaning Network!');
  return { subject, html: renderEmail({ contentHtml }) };
}

// ─── X1 cascade milestone emails (both audiences; guests get tokened links) ──

function bookingTrackLink(bookingId: string, guestToken?: string | null): string {
  return guestToken
    ? `${appUrl()}/booking/guest?token=${encodeURIComponent(guestToken)}`
    : `${appUrl()}/booking/${bookingId}`;
}

export function buildCascadeSearchingUpdate(data: {
  bookingId: string;
  customerName: string;
  serviceType: string;
  date: Date;
  guestToken?: string | null;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = "We're finding your cleaner — your booking is safe";
  const contentHtml =
    h('We&rsquo;re finding your cleaner') +
    p(`Hi ${data.customerName},`) +
    p(
      `Your chosen cleaner couldn&rsquo;t confirm your ${serviceLabelFromSlug(data.serviceType)} booking on <strong>${dateStr}</strong> &mdash; we&rsquo;re sorry about that. The good news: <strong>your booking and payment are unchanged</strong>, and we&rsquo;re already contacting great alternative cleaners at or below your original price.`
    ) +
    p(
      'You don&rsquo;t need to do anything. We&rsquo;ll email you the moment a cleaner confirms &mdash; and if we can&rsquo;t find anyone in time, you&rsquo;ll get a full refund automatically.'
    ) +
    button(bookingTrackLink(data.bookingId, data.guestToken), 'View your booking') +
    p('Thank you for your patience,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildRenaFindConcierge(data: {
  bookingId: string;
  customerName: string;
  serviceType: string;
  date: Date;
  guestToken?: string | null;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = 'Our team is personally finding your cleaner';
  const contentHtml =
    h('Our team is on it') +
    p(`Hi ${data.customerName},`) +
    p(
      `Finding the right cleaner for your ${serviceLabelFromSlug(data.serviceType)} booking on <strong>${dateStr}</strong> is taking longer than we&rsquo;d like &mdash; so our team is now <strong>personally</strong> searching our wider network for you.`
    ) +
    p(
      'Your booking and payment are unchanged. We&rsquo;ll email you as soon as a cleaner is confirmed &mdash; and if we can&rsquo;t find the right person in time, you&rsquo;ll receive a full refund automatically. You never pay for a clean that doesn&rsquo;t happen.'
    ) +
    button(bookingTrackLink(data.bookingId, data.guestToken), 'View your booking') +
    p('Thank you for bearing with us,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildCascadeExhaustedRefund(data: {
  bookingId: string;
  customerName: string;
  serviceType: string;
  date: Date;
  guestToken?: string | null;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = "We couldn't find a cleaner this time — your full refund is on its way";
  const contentHtml =
    h('We&rsquo;re sorry &mdash; and you&rsquo;re fully refunded') +
    p(`Hi ${data.customerName},`) +
    p(
      `Despite our best efforts, we couldn&rsquo;t find an available cleaner for your ${serviceLabelFromSlug(data.serviceType)} booking on <strong>${dateStr}</strong>. We&rsquo;re really sorry to let you down.`
    ) +
    p(
      '<strong>Your full refund is already being processed</strong> &mdash; it will arrive back on your original payment method within 5&ndash;10 business days. There is nothing you need to do.'
    ) +
    p(
      'If you&rsquo;d like to try a different date or time (availability changes daily), we&rsquo;d love another chance:'
    ) +
    button(`${appUrl()}/services`, 'Book another clean') +
    p('With apologies,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildSignupNotification(data: {
  name: string;
  email: string;
  phone?: string;
  role: 'CLIENT' | 'CLEANER';
  createdAt: string;
}): EmailContent {
  const roleLabel = data.role === 'CLEANER' ? 'Cleaner' : 'Customer';
  const adminUrl = `${appUrl()}/admin/users`;
  const subject = `New ${roleLabel} signup: ${data.name}`;
  const rows: Array<[string, string]> = [
    ['Name', data.name],
    ['Email', data.email],
  ];
  if (data.phone) rows.push(['Phone', data.phone]);
  rows.push(['Role', roleLabel]);
  rows.push(['Signed up', data.createdAt]);
  const contentHtml =
    h(`New ${roleLabel} Signup`) + infoBlock(rows) + button(adminUrl, 'View in admin dashboard');
  return { subject, html: renderEmail({ contentHtml }) };
}

export function buildPaymentFailureNotification(data: {
  bookingId: string;
  customerName: string;
  reason: string;
}): EmailContent {
  // The old "/booking/retry" page never existed (dead link) — the honest CTA is
  // a fresh booking, since a failed payment cancels the pending booking.
  const retryLink = `${appUrl()}/services`;
  const subject = 'Payment unsuccessful — you have not been charged';
  const contentHtml =
    h('Payment unsuccessful') +
    p(`Hi ${data.customerName},`) +
    p(
      `Unfortunately, the payment for your booking <strong>#${data.bookingId}</strong> could not be processed. <strong>You have NOT been charged</strong> and the booking was not confirmed.`
    ) +
    p(`<strong>Reason:</strong> ${data.reason}`) +
    p('You can book again with a different payment method whenever you like:') +
    button(retryLink, 'Book again') +
    p('If you continue to experience issues, please contact our support team.') +
    p('Best regards,<br/>The Rena Team');
  return { subject, html: renderEmail({ contentHtml }) };
}

// ─── Stuck-money reaper (James-approved) ─────────────────────

/** Cleaner nudge — two escalating flavours. Money-critical: completion is the
 *  only payout trigger, so an unmarked job is an unpaid cleaner. */
export function buildStuckJobNudge(data: {
  cleanerName: string;
  serviceType: string;
  date: Date;
  startTime: string;
  escalated: boolean;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = data.escalated
    ? `Action needed — mark your ${dateStr} job complete to get paid`
    : `Did you finish your ${serviceLabelFromSlug(data.serviceType).toLowerCase()} on ${dateStr}?`;
  const contentHtml =
    h(data.escalated ? 'Your payment is waiting on you' : 'Mark your job complete') +
    p(`Hi ${data.cleanerName},`) +
    p(
      `Your ${serviceLabelFromSlug(data.serviceType)} on <strong>${dateStr} at ${data.startTime}</strong> is past its scheduled end but hasn&rsquo;t been marked complete.`
    ) +
    p(
      data.escalated
        ? 'Your customer has already been charged &mdash; completing the job is what releases your payment. Until you mark it done, nothing can be paid out, and our team may need to step in to resolve the booking.'
        : 'Marking it complete is what starts your payout. It takes a few seconds from your jobs page.'
    ) +
    button(`${appUrl()}/cleaner/jobs`, 'Mark it complete') +
    p('If something went wrong with this job, reply to this email and our team will help.');
  return { subject, html: renderEmail({ contentHtml }) };
}

/** Ask-the-customer: tokened one-question check — did this clean happen?
 *  The token is the authorization (H8 matrix); yes/no lands on the case. */
export function buildJobHappenedAsk(data: {
  customerName: string;
  cleanerName: string;
  serviceType: string;
  date: Date;
  askToken: string;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = `Quick check — did your ${dateStr} clean go ahead?`;
  const link = `${appUrl()}/job-check?token=${encodeURIComponent(data.askToken)}`;
  const contentHtml =
    h('One quick question') +
    p(`Hi ${data.customerName},`) +
    p(
      `Your ${serviceLabelFromSlug(data.serviceType)} with ${data.cleanerName} on <strong>${dateStr}</strong> hasn&rsquo;t been marked complete by your cleaner, so we wanted to check with you directly.`
    ) +
    p('It takes one tap &mdash; just tell us whether the clean went ahead:') +
    button(link, 'Answer the question') +
    p(
      'Your answer helps us close the booking correctly &mdash; releasing payment if the work was done, or arranging your refund if it wasn&rsquo;t.'
    );
  return { subject, html: renderEmail({ contentHtml }) };
}

/** Force-complete notice to the customer. When they already answered YES the
 *  window copy is skipped — their yes IS the dispute window answered. */
export function buildForceCompleteNotice(data: {
  customerName: string;
  serviceType: string;
  date: Date;
  guestToken?: string | null;
  bookingId: string;
  confirmedByCustomer: boolean;
}): EmailContent {
  const dateStr = data.date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = `Your ${dateStr} clean has been marked complete`;
  const contentHtml =
    h('Booking marked complete') +
    p(`Hi ${data.customerName},`) +
    p(
      data.confirmedByCustomer
        ? `Thanks for confirming your ${serviceLabelFromSlug(data.serviceType)} on <strong>${dateStr}</strong> went ahead &mdash; we&rsquo;ve marked it complete and your cleaner&rsquo;s payment is being released.`
        : `Our team has marked your ${serviceLabelFromSlug(data.serviceType)} on <strong>${dateStr}</strong> as complete after your cleaner didn&rsquo;t confirm it. If this clean did not happen or there was a problem, report it within <strong>24 hours</strong> and the payment will be paused while we look into it.`
    ) +
    button(bookingTrackLink(data.bookingId, data.guestToken), 'View your booking') +
    p('Thank you for using Rena!');
  return { subject, html: renderEmail({ contentHtml }) };
}
