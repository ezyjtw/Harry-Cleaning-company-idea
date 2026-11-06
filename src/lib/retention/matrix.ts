// B7.3 (RENA-063, James-ruled): the retention matrix, the single source of
// truth for every class, its anchor, horizon, action and legal holds. The
// jobs in ./jobs.ts run from these rows; the privacy page's section 5 is
// checked against this table by src/lib/retention/matrix.test.ts; the
// register entry quotes it. Horizons are "up to": a job runs daily in
// batches and a held row waits, so the page says "up to N years".

export type RetentionClass =
  | 'accountData'
  | 'bookingRecords'
  | 'messages'
  | 'auditLogs'
  | 'notifications'
  | 'consentMetadata'
  | 'analytics';

export type RetentionAction = 'tombstone' | 'anonymise' | 'redact' | 'delete' | 'nullMetadata';

export interface HoldRule {
  /** Short key for logs and tests. */
  key: string;
  /** What the hold is, for the page and the register. */
  description: string;
}

export interface RetentionRow {
  class: RetentionClass;
  /** The field or expression the horizon counts from. */
  anchor: string;
  /** Whole years; the page text and the jobs use the same number. */
  horizonYears: number;
  action: RetentionAction;
  /** One sentence for the privacy page. */
  policy: string;
  holds: HoldRule[];
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const BATCH_SIZE = 200;
export const MESSAGE_REDACTED = '[message removed after 2 years]';

export const HOLDS = {
  openDispute: { key: 'open_dispute', description: 'an open dispute on a booking of the account' },
  openComplaint: {
    key: 'open_complaint',
    description: 'an open complaint on a booking of the account',
  },
  unsettledMoney: {
    key: 'unsettled_money',
    description: 'money not yet released or refunded on a paid booking of the account',
  },
  taxHold: {
    key: 'tax_hold',
    description: 'a booking of the account dated within the last 6 years (tax retention)',
  },
  bookingOpenDisputeOrComplaint: {
    key: 'open_dispute_or_complaint',
    description: 'an open dispute or complaint on the booking',
  },
  chargebackWindow: {
    key: 'chargeback_window',
    description: 'a card dispute raised within 180 days of the charge',
  },
  threadOpenDispute: {
    key: 'open_dispute',
    description: "an open dispute on the thread's booking",
  },
} as const satisfies Record<string, HoldRule>;

export const RETENTION_MATRIX: readonly RetentionRow[] = [
  {
    class: 'accountData',
    anchor: 'account closure (User.deletedAt, or updatedAt when DEACTIVATED)',
    horizonYears: 6,
    action: 'tombstone',
    policy:
      'Account data: retained while your account is active and for up to 6 years after closure, then minimised (name, contact details, addresses and profile text removed; the record itself remains so bookings and payments keep their anchor).',
    holds: [HOLDS.openDispute, HOLDS.openComplaint, HOLDS.unsettledMoney, HOLDS.taxHold],
  },
  {
    class: 'bookingRecords',
    anchor: 'Booking.date',
    horizonYears: 6,
    action: 'anonymise',
    policy:
      'Booking and payment records: retained for up to 6 years after the booking date for tax and legal compliance, then anonymised (names, contact details, address lines and notes removed; amounts, dates and statuses kept).',
    holds: [HOLDS.bookingOpenDisputeOrComplaint, HOLDS.chargebackWindow],
  },
  {
    class: 'messages',
    anchor: 'the last message in the conversation (Message.createdAt, per thread)',
    horizonYears: 2,
    action: 'redact',
    policy:
      'Messages: retained for up to 2 years after the last message in the conversation, then anonymised.',
    holds: [HOLDS.threadOpenDispute],
  },
  {
    class: 'auditLogs',
    anchor: 'AuditLog.createdAt',
    horizonYears: 7,
    action: 'delete',
    policy:
      'Audit logs: retained for up to 7 years for regulatory compliance and fraud prevention.',
    holds: [],
  },
  {
    class: 'notifications',
    anchor: 'Notification.createdAt',
    horizonYears: 2,
    action: 'delete',
    policy: 'In-app notifications: retained for up to 2 years, then deleted.',
    holds: [],
  },
  {
    class: 'consentMetadata',
    anchor: 'GdprConsent.createdAt',
    horizonYears: 2,
    action: 'nullMetadata',
    policy:
      'Consent records: the decision and its date are kept for up to 7 years as evidence; the IP address and browser details recorded with it are removed after 2 years.',
    holds: [],
  },
  {
    class: 'analytics',
    anchor: 'AnalyticsEvent.createdAt',
    horizonYears: 2,
    action: 'anonymise',
    policy:
      'Analytics data: IP addresses, user identifiers and referrers are anonymised after 2 years and page addresses reduced to their path. Aggregated, non-identifiable analytics data may be retained indefinitely.',
    holds: [],
  },
];

export function matrixRow(cls: RetentionClass): RetentionRow {
  const row = RETENTION_MATRIX.find((r) => r.class === cls);
  if (!row) throw new Error(`no retention row for ${cls}`);
  return row;
}

/** The horizon cutoff: anchors strictly before this instant are past the horizon. */
export function horizonCutoff(cls: RetentionClass, now: Date): Date {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - matrixRow(cls).horizonYears);
  return d;
}

/** The consent decision itself is kept 7 years (GdprConsent rows are not deleted here). */
export const CONSENT_DECISION_YEARS = 7;
export const CHARGEBACK_WINDOW_DAYS = 180;
