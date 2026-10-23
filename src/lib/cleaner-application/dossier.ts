// RENA-103 (James-ruled 2026-10-08, D-ag, D-ai): the admin incomplete-signup
// dossier reads the authoritative saved application, never a guess. Pure, so
// the step numbering and the removal rule are unit-tested against the sweep.

import { DOC_CATEGORIES, STEP_COUNT, type DocCategory } from './fields';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DraftForDossier {
  status: string;
  currentStep: number;
  maxReachedStep: number;
  lastActivityAt: Date;
  expiryReminderSentAt: Date | null;
  expiryReminderAttemptAt: Date | null;
  expiryReminderFailures: number;
}

/** An active draft document (review state DRAFT, not destroyed). */
export interface DraftDocumentForDossier {
  documentType: string;
  storageState: 'PENDING' | 'STORED' | 'DELETED';
}

export const DOC_LABELS: Record<DocCategory, string> = {
  photo_id: 'Photo ID',
  right_to_work: 'Right to work',
  dbs_certificate: 'DBS certificate',
  selfie: 'Selfie',
  profile_photo: 'Profile photo',
};

export interface ApplicationDossier {
  /** 1-based, as the applicant sees it ("step N of 7"). */
  savedStep: number;
  furthestStep: number;
  stepCount: number;
  lastActivityAt: string;
  warning:
    | { state: 'delivered'; at: string }
    | { state: 'undelivered'; failures: number; lastAttemptAt: string | null }
    | { state: 'not_sent' };
  /**
   * The earliest the incomplete signup sweep may remove the application:
   * the account and the draft both 30 days idle, and a delivered deletion
   * warning at least the warning window old. Null while no warning has been
   * delivered (the sweep waits for one).
   */
  removalNoSoonerThan: string | null;
  /**
   * Every document category and its draft state: uploaded (the object is
   * stored), uploading (a record exists but the object never landed; the
   * integrity sweep clears it after an hour), or not uploaded.
   */
  documents: {
    category: DocCategory;
    label: string;
    state: 'uploaded' | 'uploading' | 'missing';
  }[];
}

const toStep = (i: number) => Math.min(STEP_COUNT, Math.max(1, Math.floor(i) + 1));

export function applicationDossier(
  draft: DraftForDossier,
  accountCreatedAt: Date,
  rule: { sweepAgeDays: number; warningWindowDays: number },
  draftDocuments: DraftDocumentForDossier[] = []
): ApplicationDossier {
  const documents = DOC_CATEGORIES.map((category) => {
    const rows = draftDocuments.filter((d) => d.documentType === category);
    const state: 'uploaded' | 'uploading' | 'missing' = rows.some(
      (d) => d.storageState === 'STORED'
    )
      ? 'uploaded'
      : rows.some((d) => d.storageState === 'PENDING')
        ? 'uploading'
        : 'missing';
    return { category, label: DOC_LABELS[category], state };
  });
  const warning: ApplicationDossier['warning'] = draft.expiryReminderSentAt
    ? { state: 'delivered', at: draft.expiryReminderSentAt.toISOString() }
    : draft.expiryReminderFailures > 0
      ? {
          state: 'undelivered',
          failures: draft.expiryReminderFailures,
          lastAttemptAt: draft.expiryReminderAttemptAt?.toISOString() ?? null,
        }
      : { state: 'not_sent' };
  const removal = draft.expiryReminderSentAt
    ? new Date(
        Math.max(
          accountCreatedAt.getTime() + rule.sweepAgeDays * DAY_MS,
          draft.lastActivityAt.getTime() + rule.sweepAgeDays * DAY_MS,
          draft.expiryReminderSentAt.getTime() + rule.warningWindowDays * DAY_MS
        )
      ).toISOString()
    : null;
  return {
    savedStep: toStep(draft.currentStep),
    furthestStep: toStep(Math.max(draft.maxReachedStep, draft.currentStep)),
    stepCount: STEP_COUNT,
    lastActivityAt: draft.lastActivityAt.toISOString(),
    warning,
    removalNoSoonerThan: removal,
    documents,
  };
}
