// RENA-103 (James-ruled 2026-10-08, D-ag, D-ai): the admin incomplete-signup
// dossier reads the authoritative saved application, never a guess. Pure, so
// the step numbering and the removal rule are unit-tested against the sweep.

import { STEP_COUNT } from './fields';

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
}

const toStep = (i: number) => Math.min(STEP_COUNT, Math.max(1, Math.floor(i) + 1));

export function applicationDossier(
  draft: DraftForDossier,
  accountCreatedAt: Date,
  rule: { sweepAgeDays: number; warningWindowDays: number }
): ApplicationDossier {
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
  };
}
