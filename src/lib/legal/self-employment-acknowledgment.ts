// A14: versioned, swappable store for the cleaner self-employment document.
// Pure data — no server-only imports — so it is safe to import in client
// components (e.g. the /join wizard step). Hashing lives in the server service.
//
// v1 is an honest, minimal ACKNOWLEDGMENT — a truthful plain-English statement of
// the self-employed relationship, NOT a full legal contract. A fuller,
// lawyer-reviewed self-employment AGREEMENT will be added here as v2 (a new entry
// + bump CURRENT_VERSION); every cleaner is then prompted to re-acknowledge.
//
// The body text is the single source of truth for the hash captured on each
// acceptance (AgreementAcceptance.textHash), so a stored acceptance always points
// at the exact wording the cleaner saw. To swap/replace text later, add a new
// versioned entry rather than editing an existing one (editing would break the
// hash link for past acceptances). Could migrate to a DB-backed admin-editable
// store later if no-deploy swapping is needed; a constant is right for v1.

export type AgreementKind = 'acknowledgment' | 'agreement';

export interface AgreementDocument {
  version: string;
  kind: AgreementKind;
  title: string;
  effectiveDate: string; // ISO date
  body: string; // plain-English markdown
}

const V1: AgreementDocument = {
  version: '1',
  kind: 'acknowledgment',
  title: 'Self-Employment Acknowledgment',
  effectiveDate: '2026-07-02',
  body: `# Rena — Self-Employment Acknowledgment

Rena is a marketplace that connects self-employed cleaners with customers. Please read this and confirm you understand how you work with Rena. By ticking the box and continuing, you confirm that you understand and agree that:

1. **You are self-employed.** You work for yourself, not as an employee or worker of Rena. Rena is a platform that introduces you to customers and handles payments — it is not your employer.

2. **Your tax and National Insurance are yours.** You are responsible for registering as self-employed with HMRC and for paying your own Income Tax and National Insurance. Rena does not deduct these for you.

3. **You choose your work.** There are no set hours and no guaranteed jobs. You are free to accept or decline any job, and to stop at any time.

4. **You set your own hours.** You decide when, and how often, you are available.

5. **You set your own prices.** You decide the rates you charge for the services you offer.

6. **You can work elsewhere.** You are free to work for other platforms, agencies, or your own clients at the same time. Rena is not exclusive.

7. **You use your own equipment.** Unless you agree otherwise with a customer, you provide your own cleaning equipment and materials.

8. **You can send a substitute.** If you can't do a job you've accepted, you may send another cleaner in your place — as long as they are a current Rena-verified cleaner in good standing. You remain responsible for making sure the job is done properly.

9. **Keeping your account active.** To offer and accept jobs you must keep your verification and any required checks up to date, and treat customers and their property with care.

By ticking the box and continuing, you confirm you have read and understand this acknowledgment.`,
};

// H46 (James-ruled, variant C verbatim): v2 adds the account-removal clause
// (item 10). Never edit an existing body — a new version keeps every past
// acceptance's textHash valid. Bumping CURRENT_AGREEMENT re-prompts every
// cleaner to acknowledge v2.
const V2: AgreementDocument = {
  version: '2',
  kind: 'acknowledgment',
  title: 'Self-Employment Acknowledgment',
  effectiveDate: '2026-07-19',
  body: `# Rena — Self-Employment Acknowledgment

Rena is a marketplace that connects self-employed cleaners with customers. Please read this and confirm you understand how you work with Rena. By ticking the box and continuing, you confirm that you understand and agree that:

1. **You are self-employed.** You work for yourself, not as an employee or worker of Rena. Rena is a platform that introduces you to customers and handles payments — it is not your employer.

2. **Your tax and National Insurance are yours.** You are responsible for registering as self-employed with HMRC and for paying your own Income Tax and National Insurance. Rena does not deduct these for you.

3. **You choose your work.** There are no set hours and no guaranteed jobs. You are free to accept or decline any job, and to stop at any time.

4. **You set your own hours.** You decide when, and how often, you are available.

5. **You set your own prices.** You decide the rates you charge for the services you offer.

6. **You can work elsewhere.** You are free to work for other platforms, agencies, or your own clients at the same time. Rena is not exclusive.

7. **You use your own equipment.** Unless you agree otherwise with a customer, you provide your own cleaning equipment and materials.

8. **You can send a substitute.** If you can't do a job you've accepted, you may send another cleaner in your place — as long as they are a current Rena-verified cleaner in good standing. You remain responsible for making sure the job is done properly.

9. **Keeping your account active.** To offer and accept jobs you must keep your verification and any required checks up to date, and treat customers and their property with care.

10. **Account suspension and removal.** Rena may suspend or permanently remove your account at its sole discretion. Where we reasonably believe it is necessary to protect customers, cleaners, or the platform — including safety, fraud, or serious or repeated breaches of these terms — we may do so immediately and without prior notice. Removal does not affect your right to payment for work already completed, and where a decision was made in error you may contact us to have it reviewed.

By ticking the box and continuing, you confirm you have read and understand this acknowledgment.`,
};

/** All versions, keyed by version string. Add new versions here; never edit an existing body. */
export const AGREEMENTS: Record<string, AgreementDocument> = {
  [V1.version]: V1,
  [V2.version]: V2,
};

/** The version cleaners must currently have acknowledged. Bump when adding a new version. */
export const CURRENT_AGREEMENT: AgreementDocument = V2;
export const CURRENT_AGREEMENT_VERSION = CURRENT_AGREEMENT.version;

export function getAgreement(version: string): AgreementDocument | null {
  return AGREEMENTS[version] ?? null;
}
