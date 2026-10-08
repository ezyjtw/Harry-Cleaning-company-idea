// RENA-100/101 (cleaner application resume, James-ruled 2026-10-08): the
// server's own description of the join wizard. Pure, so the save and the
// finalisation share one rule set and the table is unit-tested.
//
// The draft holds only typed, bounded wizard fields. It never holds the
// password, the email (that is the account's own), file bytes, or the date of
// birth (restricted vetting data, a column of its own). Unknown keys are
// dropped, never stored.

import { SERVICE_TYPE_SLUGS } from '@/lib/constants/services';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

export const STEP_COUNT = 7;
/** The last step whose Continue saves; step 6 (Review) finalises instead. */
export const LAST_SAVED_STEP = 5;

export const DOC_CATEGORIES = [
  'photo_id',
  'right_to_work',
  'dbs_certificate',
  'selfie',
  'profile_photo',
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export function isDocCategory(v: unknown): v is DocCategory {
  return typeof v === 'string' && (DOC_CATEGORIES as readonly string[]).includes(v);
}

/** Selfie and profile photo are photographs; the identity documents may be PDFs. */
export function categoryAllowsPdf(c: DocCategory): boolean {
  return c === 'photo_id' || c === 'right_to_work' || c === 'dbs_certificate';
}

export const RTW_DOC_TYPES = [
  'uk_passport',
  'irish_passport',
  'brp',
  'eu_settled',
  'eu_pre_settled',
  'share_code',
  'visa',
] as const;

const DBS_OPTIONS = ['existing', 'want', 'none'] as const;
const SELFIE_PROVENANCE = ['webcam', 'capture', 'upload'] as const;
const HOURLY_SERVICES = new Set(['regular', 'deep', 'same_day']);

export interface DraftData {
  firstName: string;
  lastName: string;
  phone: string;
  postcode: string;
  yearsExperience: string;
  serviceTypes: string[];
  specialties: string[];
  languages: string[];
  bio: string;
  serviceRates: Record<string, string>;
  hoursPerWeek: string;
  maxTravelMinutes: string;
  rightToWorkDocType: string;
  rightToWorkShareCode: string;
  rightToWorkExpiryDate: string;
  dbsOption: string;
  dbsCertNumber: string;
  dbsCertIssueDate: string;
  selfieProvenance: string;
  livenessComplete: boolean;
  acknowledgeSelfEmployment: boolean;
}

const STRING_LIMITS: Record<string, number> = {
  firstName: 60,
  lastName: 60,
  phone: 30,
  postcode: 12,
  yearsExperience: 4,
  bio: 2000,
  hoursPerWeek: 4,
  maxTravelMinutes: 4,
  rightToWorkDocType: 30,
  rightToWorkShareCode: 20,
  rightToWorkExpiryDate: 10,
  dbsOption: 10,
  dbsCertNumber: 20,
  dbsCertIssueDate: 10,
  selfieProvenance: 10,
};
const ARRAY_KEYS = ['serviceTypes', 'specialties', 'languages'] as const;
const BOOL_KEYS = ['livenessComplete', 'acknowledgeSelfEmployment'] as const;

/** Typed, bounded copy of a client payload; anything else is dropped. */
export function sanitizeDraftData(input: unknown): DraftData {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(STRING_LIMITS)) {
    const v = src[k];
    out[k] = typeof v === 'string' ? v.slice(0, max) : '';
  }
  for (const k of ARRAY_KEYS) {
    const v = src[k];
    out[k] = Array.isArray(v)
      ? Array.from(
          new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 60)))
        ).slice(0, 20)
      : [];
  }
  for (const k of BOOL_KEYS) out[k] = src[k] === true;
  const rates: Record<string, string> = {};
  const r = src.serviceRates;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    for (const [svc, val] of Object.entries(r as Record<string, unknown>)) {
      if ((SERVICE_TYPE_SLUGS as readonly string[]).includes(svc) && typeof val === 'string') {
        rates[svc] = val.slice(0, 6);
      }
    }
  }
  out.serviceRates = rates;
  return out as unknown as DraftData;
}

/** A yyyy-mm-dd string as a UTC date, or null. */
export function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export interface StepContext {
  /** Categories with a STORED, active draft document. */
  storedDocs: ReadonlySet<DocCategory>;
  dateOfBirth: Date | null;
  now: Date;
}

/** Required document categories for the data as it stands. */
export function requiredCategories(d: DraftData): DocCategory[] {
  const req: DocCategory[] = ['photo_id', 'right_to_work', 'selfie'];
  if (d.dbsOption === 'existing') req.push('dbs_certificate');
  return req;
}

/**
 * Server errors for one wizard step (field name to message), mirroring the
 * page's own rules so a save the page allows is never refused. An empty
 * object means the step is complete.
 */
export function stepErrors(step: number, d: DraftData, ctx: StepContext): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (!d.firstName.trim()) e.firstName = 'First name is required';
    if (!d.lastName.trim()) e.lastName = 'Last name is required';
    if (d.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    if (!normalizeUkPostcode(d.postcode)) e.postcode = 'Enter a valid UK postcode';
    if (!ctx.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    else if (ageOn(ctx.dateOfBirth, ctx.now) < 18)
      e.dateOfBirth = 'You must be at least 18 years old to register';
  }
  if (step === 1) {
    const yrs = Number(d.yearsExperience);
    if (d.yearsExperience === '' || Number.isNaN(yrs) || yrs < 0 || yrs > 50)
      e.yearsExperience = 'Enter your years of experience (0 to 50)';
    const svc = d.serviceTypes.filter((s) => (SERVICE_TYPE_SLUGS as readonly string[]).includes(s));
    if (svc.length === 0 || svc.length !== d.serviceTypes.length)
      e.serviceTypes = 'Select at least one service type';
    if (d.languages.length === 0) e.languages = 'Select at least one language';
    if (!d.bio.trim()) e.bio = 'Please write a short bio';
  }
  if (step === 2) {
    for (const svc of d.serviceTypes) {
      if (!HOURLY_SERVICES.has(svc)) continue;
      const rate = Number(d.serviceRates[svc]);
      if (!d.serviceRates[svc] || Number.isNaN(rate) || rate < 14 || rate > 100)
        e[`rate_${svc}`] = 'Enter a rate between £14 and £100 an hour';
    }
    if (!(Number(d.hoursPerWeek) >= 1)) e.hoursPerWeek = 'Enter your typical hours per week';
    const mtm = Number(d.maxTravelMinutes);
    if (Number.isNaN(mtm) || mtm < 5 || mtm > 120)
      e.maxTravelMinutes = 'Travel time must be between 5 and 120 minutes';
  }
  if (step === 3) {
    if (!ctx.storedDocs.has('photo_id')) e.photoIdFile = 'Photo ID is required';
    if (!(RTW_DOC_TYPES as readonly string[]).includes(d.rightToWorkDocType))
      e.rightToWorkDocType = 'Please select your document type';
    if (!ctx.storedDocs.has('right_to_work'))
      e.rightToWorkDocFile = 'Right to work document is required';
    if (d.rightToWorkDocType === 'share_code' && !d.rightToWorkShareCode.trim())
      e.rightToWorkShareCode = 'Please enter your gov.uk share code';
  }
  if (step === 4) {
    if (!(DBS_OPTIONS as readonly string[]).includes(d.dbsOption))
      e.dbsOption = 'Please select a DBS option';
    if (d.dbsOption === 'existing') {
      if (!/^\d{12}$/.test(d.dbsCertNumber.trim())) e.dbsCertNumber = 'Must be a 12-digit number';
      const issued = parseIsoDate(d.dbsCertIssueDate);
      const threeYearsAgo = new Date(ctx.now);
      threeYearsAgo.setUTCFullYear(threeYearsAgo.getUTCFullYear() - 3);
      if (!issued) e.dbsCertIssueDate = 'Issue date is required';
      else if (issued < threeYearsAgo)
        e.dbsCertIssueDate = 'DBS certificate must be less than 3 years old';
      if (!ctx.storedDocs.has('dbs_certificate'))
        e.dbsCertFile = 'Please upload your DBS certificate';
    }
    if (!ctx.storedDocs.has('selfie'))
      e.selfiePhoto = 'Selfie is required for identity verification';
    if (
      d.selfieProvenance &&
      !(SELFIE_PROVENANCE as readonly string[]).includes(d.selfieProvenance)
    )
      e.selfiePhoto = 'Selfie is required for identity verification';
  }
  if (step === 5) {
    if (!d.acknowledgeSelfEmployment)
      e.acknowledgeSelfEmployment =
        'Please confirm you understand you work with Rena as self-employed';
  }
  return e;
}

/** Every step through Terms; the first failing step and its errors, or null. */
export function firstIncompleteStep(
  d: DraftData,
  ctx: StepContext
): { step: number; errors: Record<string, string> } | null {
  for (let s = 0; s <= LAST_SAVED_STEP; s += 1) {
    const errors = stepErrors(s, d, ctx);
    if (Object.keys(errors).length) return { step: s, errors };
  }
  return null;
}
