import { prisma } from '@/lib/db/prisma';
import { REPORT_REASON_LABELS, type ReportReason } from '@/lib/reports';

import { HqCard, HqLabel, RoomShell } from '../HqKit';

import ResolveReportForm from './ResolveReportForm';

export const dynamic = 'force-dynamic';

// UGC Reports room (James-ordered, Apple 1.2 / Play content rating): every
// open user report in one queue, in the Declines-room grammar. Three kinds
// share the room: a REVIEW report, a CONVERSATION report (a whole chat
// partner) and a per-message report (the older MessageReport queue, user or
// system flagged). Each resolves WITH a written reason. Resolving changes
// nothing else by itself: no review is hidden, no account touched, here.

const MESSAGE_REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Harassment',
  OFF_PLATFORM: 'Off-platform contact',
  INAPPROPRIATE: 'Inappropriate',
  OTHER: 'Other',
};

function when(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Person({ name, email }: { name: string | null; email: string | null }) {
  return (
    <span className="font-medium text-[#16296b]">
      {name ?? 'Unknown'}
      {email ? <span className="font-light text-[#8A97AB]"> · {email}</span> : null}
    </span>
  );
}

export default async function ReportsRoom() {
  const [content, messages, resolvedContent, resolvedMessages] = await Promise.all([
    prisma.contentReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        reporter: { select: { name: true, email: true } },
        reportedUser: { select: { name: true, email: true } },
        review: { select: { text: true, rating: true, cleaner: { select: { name: true } } } },
      },
    }),
    prisma.messageReport.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      include: {
        message: { select: { content: true, createdAt: true } },
        reporter: { select: { name: true, email: true } },
        reportedUser: { select: { name: true, email: true } },
      },
    }),
    prisma.contentReport.findMany({
      where: { status: 'RESOLVED' },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
      include: {
        reporter: { select: { name: true } },
        reportedUser: { select: { name: true } },
      },
    }),
    prisma.messageReport.findMany({
      where: { status: { in: ['ACTIONED', 'DISMISSED'] } },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
      include: { reportedUser: { select: { name: true } } },
    }),
  ]);

  const openCount = content.length + messages.length;

  return (
    <RoomShell
      title="Reports"
      subtitle={`What people have flagged, oldest first. ${openCount} open. Every report resolves with a written reason; resolving here changes nothing else on its own.`}
    >
      <div className="space-y-4">
        {openCount === 0 && (
          <HqCard className="p-5">
            <HqLabel>Open</HqLabel>
            <p className="mt-2 text-sm font-light text-[#8A97AB]">Nothing waiting.</p>
          </HqCard>
        )}

        {content.map((r) => (
          <div key={r.id} data-testid={`hq-report-${r.id}`}>
            <HqCard className="p-5">
              <div className="flex items-center justify-between">
                <HqLabel>{r.target === 'REVIEW' ? 'Review' : 'Conversation'}</HqLabel>
                <span className="text-[11px] font-light text-[#8A97AB]">{when(r.createdAt)}</span>
              </div>
              {r.target === 'REVIEW' && r.review ? (
                <blockquote className="mt-3 rounded-xl bg-[#FAFBFC] px-4 py-3 text-sm font-light text-[#3D5170]">
                  <span className="text-[#16296b]">
                    {'★'.repeat(Math.round(Number(r.review.rating)))}
                  </span>{' '}
                  {r.review.text ? `“${r.review.text}”` : '(no written text)'}
                  {r.review.cleaner?.name ? (
                    <span className="block pt-1 text-[11px] text-[#8A97AB]">
                      a review of {r.review.cleaner.name}
                    </span>
                  ) : null}
                </blockquote>
              ) : (
                <p className="mt-3 text-sm font-light text-[#3D5170]">
                  The whole conversation with the person reported.
                  {r.bookingId ? (
                    <span className="text-[#8A97AB]"> Latest shared booking {r.bookingId}.</span>
                  ) : null}
                </p>
              )}
              <dl className="mt-3 grid grid-cols-1 gap-1 text-sm font-light text-[#3D5170] sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reporter
                  </dt>
                  <dd>
                    <Person name={r.reporter.name} email={r.reporter.email} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reported
                  </dt>
                  <dd>
                    <Person name={r.reportedUser.name} email={r.reportedUser.email} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reason
                  </dt>
                  <dd>{REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}</dd>
                </div>
                {r.details ? (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                      Their note
                    </dt>
                    <dd>{r.details}</dd>
                  </div>
                ) : null}
              </dl>
              <ResolveReportForm kind="content" id={r.id} />
            </HqCard>
          </div>
        ))}

        {messages.map((r) => (
          <div key={r.id} data-testid={`hq-report-${r.id}`}>
            <HqCard className="p-5">
              <div className="flex items-center justify-between">
                <HqLabel>Message{r.origin === 'SYSTEM' ? ' · auto-flagged' : ''}</HqLabel>
                <span className="text-[11px] font-light text-[#8A97AB]">{when(r.createdAt)}</span>
              </div>
              <blockquote className="mt-3 rounded-xl bg-[#FAFBFC] px-4 py-3 text-sm font-light text-[#3D5170]">
                “{r.message.content}”
                <span className="block pt-1 text-[11px] text-[#8A97AB]">
                  sent {when(r.message.createdAt)} · booking {r.bookingId}
                </span>
              </blockquote>
              <dl className="mt-3 grid grid-cols-1 gap-1 text-sm font-light text-[#3D5170] sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reporter
                  </dt>
                  <dd>
                    {r.reporter ? (
                      <Person name={r.reporter.name} email={r.reporter.email} />
                    ) : (
                      <span className="text-[#8A97AB]">Rena (automatic contact-info check)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reported
                  </dt>
                  <dd>
                    <Person name={r.reportedUser.name} email={r.reportedUser.email} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Reason
                  </dt>
                  <dd>{MESSAGE_REASON_LABELS[r.reason] ?? r.reason}</dd>
                </div>
                {r.details ? (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                      Their note
                    </dt>
                    <dd>{r.details}</dd>
                  </div>
                ) : null}
              </dl>
              <ResolveReportForm kind="message" id={r.id} />
            </HqCard>
          </div>
        ))}

        <HqCard className="p-5">
          <HqLabel>Resolved recently</HqLabel>
          {resolvedContent.length === 0 && resolvedMessages.length === 0 ? (
            <p className="mt-2 text-sm font-light text-[#8A97AB]">None yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm font-light text-[#3D5170]">
              {resolvedContent.map((r) => (
                <li key={r.id} className="border-b border-[#F1F4F8] pb-2 last:border-b-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    {r.target === 'REVIEW' ? 'Review' : 'Conversation'}
                  </span>{' '}
                  <span className="font-medium text-[#16296b]">
                    {r.reportedUser.name ?? 'Unknown'}
                  </span>{' '}
                  reported by {r.reporter.name ?? 'Unknown'} ·{' '}
                  {REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason}
                  {r.resolvedAt ? ` · resolved ${when(r.resolvedAt)}` : ''}
                  {r.resolution ? (
                    <span className="block text-[#8A97AB]">“{r.resolution}”</span>
                  ) : null}
                </li>
              ))}
              {resolvedMessages.map((r) => (
                <li key={r.id} className="border-b border-[#F1F4F8] pb-2 last:border-b-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Message · {r.status.toLowerCase()}
                  </span>{' '}
                  <span className="font-medium text-[#16296b]">
                    {r.reportedUser.name ?? 'Unknown'}
                  </span>{' '}
                  · {MESSAGE_REASON_LABELS[r.reason] ?? r.reason}
                  {r.reviewedAt ? ` · ${when(r.reviewedAt)}` : ''}
                  {r.adminNotes ? (
                    <span className="block text-[#8A97AB]">“{r.adminNotes}”</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </HqCard>

        <p className="text-[11px] font-light italic text-[#8A97AB]">
          A report is a flag, never a verdict: reviews stay published and accounts stay as they are
          until a person decides otherwise elsewhere in admin. The person reported is never told who
          reported them.
        </p>
      </div>
    </RoomShell>
  );
}
