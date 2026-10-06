// UGC report vocabulary, shared by the report sheet (client) and the report
// API (server). One enum on the database (ContentReportReason); each target
// shows its own honest subset.

export type ReportTarget = 'REVIEW' | 'CONVERSATION';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'OFF_PLATFORM'
  | 'INAPPROPRIATE'
  | 'FALSE_OR_MISLEADING'
  | 'PRIVACY'
  | 'OTHER';

export const REPORT_REASONS: Record<ReportTarget, ReadonlyArray<[ReportReason, string]>> = {
  REVIEW: [
    ['FALSE_OR_MISLEADING', 'Not a genuine review'],
    ['HARASSMENT', 'Abusive or threatening'],
    ['INAPPROPRIATE', 'Offensive content'],
    ['PRIVACY', 'Shares private details'],
    ['OTHER', 'Something else'],
  ],
  CONVERSATION: [
    ['HARASSMENT', 'Abusive or threatening'],
    ['SPAM', 'Spam or scam'],
    ['OFF_PLATFORM', 'Pushing to pay or book outside Rena'],
    ['INAPPROPRIATE', 'Offensive content'],
    ['OTHER', 'Something else'],
  ],
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam or scam',
  HARASSMENT: 'Abusive or threatening',
  OFF_PLATFORM: 'Off-platform',
  INAPPROPRIATE: 'Offensive content',
  FALSE_OR_MISLEADING: 'Not a genuine review',
  PRIVACY: 'Shares private details',
  OTHER: 'Something else',
};

export function isReportReason(value: unknown, target: ReportTarget): value is ReportReason {
  return REPORT_REASONS[target].some(([v]) => v === value);
}

/** The standing contact line, as ruled: one address, everywhere. */
export const SUPPORT_EMAIL = 'support@renacleaning.co.uk';
