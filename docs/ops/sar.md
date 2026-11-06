# Subject access requests (SAR): the admin checklist

B7.4 (RENA-064, D-k, James-ruled). The portability export the account offers
("Download my data") is a portable copy of the account data, its categories
named in the file (`EXPORT_CATEGORIES` in `src/lib/services/gdpr.service.ts`).
The full right of access (UK GDPR Article 15) is this process. One published
inbox for rights requests: legal@renacleaning.co.uk (James, 2026-10-07).

## Record keeping

No new table. Each request is a line of `DataRetentionLog` rows with
`entityType = SubjectAccessRequest` and `entityId = <reference>`, written from
the admin compliance page (Subject access requests section) or the actions
`sar_received`, `sar_extended` and `sar_fulfilled` on `POST /api/admin/compliance`.
The reference is admin-chosen (for example `SAR-2026-0001`), letters, digits
and hyphens only, never the requester's name or email: the rows carry no
personal data. The clock: one month from receipt; one extension of up to two
further months for a complex or numerous request, and the requester is told
within the first month. The page shows each open request's deadline and marks
it overdue past that date.

## Steps

1. Receive. Acknowledge by reply from legal@. Log it on the compliance page
   as received (reference, date received). Note the date in the reply.
2. Identity. Confirm the requester controls the account email (a reply from
   that address is enough for an account holder; a guest with no account
   proves the booking email the same way). Do not ask for documents unless
   doubt remains. Nothing is sent until identity is confirmed.
3. Scope. Ask what they want if the request is unclear, without stopping the
   clock unless the request is genuinely unworkable without the answer.
4. Pull the data. The eleven sources, by internal id only:
   1. the account record and addresses (`User`, `Address`);
   2. bookings as a customer and, for a cleaner, jobs assigned
      (`Booking`, both sides, with `Review`);
   3. messages they sent or received (`Message`, both sides of each thread);
   4. disputes and complaints they raised or are party to
      (`Dispute`, `Complaint`);
   5. reports they filed and blocks they set (`MessageReport`, `Block`);
   6. consents and notification preferences (`GdprConsent`,
      `NotificationPreference`);
   7. agreement acceptances and the cleaner application record where one
      exists (`CleanerAgreement`, `CleanerApplicationDraft`);
   8. document metadata, not the files, unless the files are theirs and still
      held (`DocumentUpload`: type, state, dates);
   9. device and push registrations (`DeviceSession`, push subscriptions);
   10. audit rows where they are the actor or the subject (`AuditLog`);
   11. analytics events tied to their user id (`AnalyticsEvent`).
       Imported reviews about a cleaner are the reviewer's words and the
       cleaner's data at once: include the text, not the reviewer's identity.
5. Third parties. Redact other people's personal data (the other side of a
   message, a cleaner's or customer's details) unless they consented or it is
   reasonable to disclose. Keep money, booking and audit facts.
6. Deliver. A plain, readable file (JSON or CSV plus a short covering note
   naming each source above and what it holds, or that it holds nothing),
   sent to the confirmed address. Log it as fulfilled on the compliance page.
7. Refusal or charge. Only for a manifestly unfounded or excessive request,
   explained in writing with the right to complain to the ICO. Record the
   reason in the fulfilment note.

## What never goes in a SAR response

Another person's contact details or message bodies beyond what the requester
already saw; secret values, keys or tokens; internal risk notes about a third
party; our legal advice.
