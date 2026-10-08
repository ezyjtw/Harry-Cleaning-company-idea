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
): Promise<{ inactivity: number; expiry: number }> {
  const out = { inactivity: 0, expiry: 0 };
  const passes = [
    {
      kind: 'inactivity' as const,
      marker: 'inactivityReminderSentAt' as const,
      dueBefore: new Date(now.getTime() - INACTIVITY_REMINDER_DAYS * DAY_MS),
    },
    {
      kind: 'expiry' as const,
      marker: 'expiryReminderSentAt' as const,
      dueBefore: new Date(now.getTime() - (SWEEP_AGE_DAYS - EXPIRY_REMINDER_DAYS_BEFORE) * DAY_MS),
    },
  ];
  for (const pass of passes) {
    const due = await prisma.cleanerApplicationDraft.findMany({
      where: {
        status: 'IN_PROGRESS',
        lastActivityAt: { lte: pass.dueBefore },
        [pass.marker]: null,
        user: {
          isDeleted: false,
          role: 'CLEANER',
          cleanerProfile: { is: null },
          ...(pass.kind === 'expiry' ? { email: { notIn: SWEEP_EXEMPT_EMAILS } } : {}),
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
    for (const row of due) {
      // The claim: exactly one run sets the marker, and only while the row is
      // still due (a resume in between moves lastActivityAt and wins).
      const claim = await prisma.cleanerApplicationDraft.updateMany({
        where: {
          id: row.id,
          status: 'IN_PROGRESS',
          [pass.marker]: null,
          lastActivityAt: { lte: pass.dueBefore },
        },
        data: { [pass.marker]: now },
      });
      if (claim.count !== 1) continue;
      const firstName = firstNameOf(row.data, row.user.name);
      try {
        const sent =
          pass.kind === 'inactivity'
            ? await send.inactivity(row.user.email, firstName)
            : await send.expiry(
                row.user.email,
                firstName,
                new Date(row.lastActivityAt.getTime() + SWEEP_AGE_DAYS * DAY_MS)
              );
        if (sent) out[pass.kind] += 1;
        else
          log.error('cleaner_application', 'reminder_not_sent', {
            userId: row.userId,
            kind: pass.kind,
          });
      } catch (err) {
        // Never repeat beats at-least-once: the marker stays, loudly.
        log.error(
          'cleaner_application',
          'reminder_failed',
          { userId: row.userId, kind: pass.kind },
          err
        );
      }
    }
  }
  return out;
}
