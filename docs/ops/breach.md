# Personal data breach process

B7.8 (RENA-072). The record lives in `BreachIncident`, written from the admin
compliance page (Breaches section) through the `report_breach` and
`update_breach` actions on `POST /api/admin/compliance`. No personal data goes
in the title, description or notes: internal ids and counts only. The 72 hour
clock to the ICO runs from detection.

## 1. Detect

Any of: an alert (Sentry, the operations inbox, the scheduler heartbeat), a
report from a customer, cleaner or processor, or a finding in a review. The
person who sees it opens the record at once: title, description without
personal data, severity, detection time, data types affected, the count of
individuals if known. The record's status is DETECTED.

## 2. Contain

Stop the exposure: revoke the credential, sign out the sessions
(`revokeAllSessions`), take the route down, pause the processor. Record the
containment time (`containedAt`, status CONTAINED). Preserve evidence:
deploy logs, the audit rows, the edge log.

## 3. Assess notifiability

Within the first day, decide whether the breach is likely to result in a risk
to people's rights and freedoms (identity documents, payment details, access
notes or messages exposed to someone who should not have them usually are;
an internal id or a count usually is not). Record `isNotifiable`. If in
doubt, treat it as notifiable.

## 4. Notify the ICO within 72 hours

For a notifiable breach, report to the ICO within 72 hours of detection using
the ICO's online form, then record `reportedToIcoAt` and the ICO reference
(`icoNotificationRef`, status REPORTED_TO_ICO). If the report cannot be
complete in 72 hours, report what is known and say what follows.

## 5. Tell the people affected

Where the risk is high, tell the affected people without undue delay in plain
language: what happened, what data, what we have done, what they can do,
whom to contact (legal@renacleaning.co.uk). The list of affected user ids is
held on the record (`affectedUsers`), never in the notes or the log.

## 6. Resolve and learn

Record the root cause, the remedial actions and the lessons
(`rootCause`, `remedialActions`, `lessonsLearned`, `resolvedAt`, status
RESOLVED). A remedial action that changes code goes through the register as
a finding with its own gate.
