// RENA-100 (James-ruled 2026-10-08): the unfinished application's lifecycle.
//
//   Reminder 1   after 2 days without activity.
//   Reminder 2   3 days before expiry (27 days without activity).
//   Expiry       30 days without activity, through the existing incomplete
//                signup sweep (incomplete-signup.service.ts), which removes the
//                draft, its documents and their objects, and the account.
//
// Both reminders anchor to lastActivityAt. Each has its own marker, claimed by
// a compare-and-set before the email is sent and never cleared, so repeated
// or overlapping scheduler runs can never send either twice. Resuming moves
// lastActivityAt (no longer due); submitting or deleting removes the
// candidate. Service emails only; no push.

import prisma from '@/lib/db/prisma';
import { log } from '@/lib/log';
import {
  sendApplicationExpiryReminder,
  sendApplicationInactivityReminder,
} from '@/lib/services/email.service';
import { SWEEP_AGE_DAYS, SWEEP_EXEMPT_EMAILS } from '@/lib/services/incomplete-signup.service';

const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVITY_REMINDER_DAYS = 2;
export const EXPIRY_REMINDER_DAYS_BEFORE = 3;
const BATCH = 50;

type Send = {
  inactivity: (email: string, firstName: string) => Promise<boolean>;
  expiry: (email: string, firstName: string, expiresOn: Date) => Promise<boolean>;
};
const realSend: Send = {
  inactivity: sendApplicationInactivityReminder,
  expiry: sendApplicationExpiryReminder,
};

function firstNameOf(data: unknown, fallback: string | null): string {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const f = typeof d.firstName === 'string' ? d.firstName.trim() : '';
  return f || (fallback ?? '').split(' ')[0] || '';
}

export async function sendApplicationReminders(
  now: Date = new Date(),
  send: Send = realSend
): Promise<{ inactivity: number; expiry: number; expiryFailed: number }> {
  const out = { inactivity: 0, expiry: 0, expiryFailed: 0 };

  // ─── Reminder 1, the 2-day nudge (James-ruled: claim, then send; a failed
  // nudge is not retried, never repeating wins) ───
  const nudgeDue = new Date(now.getTime() - INACTIVITY_REMINDER_DAYS * DAY_MS);
  const nudges = await prisma.cleanerApplicationDraft.findMany({
    where: {
      status: 'IN_PROGRESS',
      lastActivityAt: { lte: nudgeDue },
      inactivityReminderSentAt: null,
      user: { isDeleted: false, role: 'CLEANER', cleanerProfile: { is: null } },
    },
    select: { id: true, userId: true, data: true, user: { select: { email: true, name: true } } },
    take: BATCH,
  });
  for (const row of nudges) {
    // The claim: exactly one run sets the marker, and only while the row is
    // still due (a resume in between moves lastActivityAt and wins).
    const claim = await prisma.cleanerApplicationDraft.updateMany({
      where: {
        id: row.id,
        status: 'IN_PROGRESS',
        inactivityReminderSentAt: null,
        lastActivityAt: { lte: nudgeDue },
      },
      data: { inactivityReminderSentAt: now },
    });
    if (claim.count !== 1) continue;
    try {
      if (await send.inactivity(row.user.email, firstNameOf(row.data, row.user.name)))
        out.inactivity += 1;
      else
        log.error('cleaner_application', 'reminder_not_sent', {
          userId: row.userId,
          kind: 'inactivity',
        });
    } catch (err) {
      log.error(
        'cleaner_application',
        'reminder_failed',
        { userId: row.userId, kind: 'inactivity' },
        err
      );
    }
  }

  // ─── Reminder 2, the deletion warning (James-ruled delivery gate) ───
  // Marked sent ONLY after a successful send. Each attempt is claimed by a
  // CAS on expiryReminderAttemptAt, at most once a day, so overlapping runs
  // never double send and a failure retries the next day. Expiry waits for
  // a delivered warning plus its window (incomplete-signup.service.ts).
  const warnDue = new Date(now.getTime() - (SWEEP_AGE_DAYS - EXPIRY_REMINDER_DAYS_BEFORE) * DAY_MS);
  const retryBefore = new Date(now.getTime() - DAY_MS);
  const attemptable = {
    status: 'IN_PROGRESS' as const,
    lastActivityAt: { lte: warnDue },
    expiryReminderSentAt: null,
    OR: [{ expiryReminderAttemptAt: null }, { expiryReminderAttemptAt: { lte: retryBefore } }],
  };
  const warnings = await prisma.cleanerApplicationDraft.findMany({
    where: {
      ...attemptable,
      user: {
        isDeleted: false,
        role: 'CLEANER',
        cleanerProfile: { is: null },
        email: { notIn: SWEEP_EXEMPT_EMAILS },
      },
    },
    select: {
      id: true,
      userId: true,
      data: true,
      lastActivityAt: true,
      user: { select: { email: true, name: true } },
    },
    take: BATCH,
  });
  for (const row of warnings) {
    const claim = await prisma.cleanerApplicationDraft.updateMany({
      where: { id: row.id, ...attemptable },
      data: { expiryReminderAttemptAt: now },
    });
    if (claim.count !== 1) continue;
    // The earliest the sweep may act: 30 idle days, and never sooner than the
    // warning window after this delivery.
    const closesOn = new Date(
      Math.max(
        row.lastActivityAt.getTime() + SWEEP_AGE_DAYS * DAY_MS,
        now.getTime() + EXPIRY_REMINDER_DAYS_BEFORE * DAY_MS
      )
    );
    let delivered = false;
    try {
      delivered = await send.expiry(row.user.email, firstNameOf(row.data, row.user.name), closesOn);
    } catch (err) {
      log.error('cleaner_application', 'expiry_warning_failed', { userId: row.userId }, err);
    }
    if (delivered) {
      await prisma.cleanerApplicationDraft.updateMany({
        where: { id: row.id, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: now },
      });
      out.expiry += 1;
    } else {
      await prisma.cleanerApplicationDraft.updateMany({
        where: { id: row.id },
        data: { expiryReminderFailures: { increment: 1 } },
      });
      out.expiryFailed += 1;
      log.error('cleaner_application', 'expiry_warning_undelivered', { userId: row.userId });
    }
  }
  return out;
}
