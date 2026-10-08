# Privacy data inventory

Created 8 Oct 2026 on James's ruling (cleaner application resume, RENA-100
and RENA-101). This is the internal record of what personal data the
platform holds, why, who can reach it, how long it is kept and how it is
deleted. It starts with the two items the application resume work added.
Other categories are added as each batch touches them.

The public privacy page (/privacy) is unchanged by this file. Its wording
must cover both items below, and that is a named item for the B7 legal
sign-off.

## Date of birth (cleaner applicants and cleaners)

- **What:** a cleaner applicant's date of birth, a calendar date with no
  time.
- **Where:** `CleanerApplicationDraft.dateOfBirth` while the application is
  unfinished. On submit it is carried into `CleanerVetting.dateOfBirth`, the
  verification record.
- **Purpose:** identity and age vetting for right to work and DBS checks
  (applicants must be 18 or over). The same purpose string is stored on the
  vetting record (`CleanerVetting.purpose`).
- **Who can access it:**
  - The applicant: their own value, through their own signed-in application
    (`GET /api/cleaners/application`).
  - Admins: the admin cleaner dossier, labelled "Date of birth (vetting)".
  - No customer surface and no pre-accept surface reads it.
  - It is never written to logs, analytics, emails or push messages.
- **Retention:**
  - Unfinished application: deleted with the application after 30 days
    without activity, or sooner if an admin removes the application.
  - Submitted application: kept on the vetting record for as long as the
    cleaner account exists.
- **Deletion:**
  - Both records are deleted with the user account (database cascade from
    User).
  - Unfinished applications are removed by the incomplete signup sweep or by
    the admin removal action (`removeIncompleteSignup`).

## Draft application documents (cleaner applicants)

- **What:** files an applicant uploads before submitting:
  - photo ID
  - right to work document
  - DBS certificate
  - selfie
  - profile photo
- **Where:**
  - The encrypted document store: the R2 bucket, objects encrypted at rest
    under a per-file key reference.
  - One `DocumentUpload` row per file, with review state DRAFT.
  - On submit the rows move to SUBMITTED and are linked to the cleaner
    profile.
- **Purpose:** verifying the applicant's identity, right to work and DBS
  status, so the application can be reviewed.
- **Who can access it:**
  - The applicant: their own documents only.
  - Admins: through the document view.
  - Every view is audited.
  - The owner is always taken from the signed-in session, never from a
    request.
- **Retention:**
  - Under the same unfinished-application retention as the date of birth:
    deleted after 30 days without activity, or on admin removal.
  - A document the applicant replaces or removes is deleted when replaced or
    removed.
  - After submit, documents follow the existing verified-document retention
    rules (compliance scheduler).
- **Deletion:**
  - The storage object is deleted before its row. A failed object delete
    stops the removal and is retried, so no file is ever left without a
    record.
  - An interrupted upload (a row still PENDING after an hour) is swept with
    its object.
