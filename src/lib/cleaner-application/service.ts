// RENA-100/101 (cleaner application resume, James-ruled 2026-10-08): the
// server-side home of the join wizard.
//
//   Ownership   The applicant is always the session's CLEANER user. No route
//               takes a user id, an email or a document owner from a body.
//   Version     Every save carries the version it loaded; it lands only on a
//               matching version and increments it. A stale save is 409
//               APPLICATION_UPDATED and the page reloads the server copy.
//   Documents   Uploaded when selected as DRAFT documents in the encrypted
//               store; exactly one active per category; a replacement names
//               the document it replaces and retires the old object.
//   Finalise    No uploads. The authoritative draft is reloaded and every
//               required step, field and STORED document confirmed; the
//               profile, agreement, vetting record and SUBMITTED state are one
//               transaction; emails and the handoff only after commit. Any
//               failure leaves the draft resumable.

import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';

import { mintNativeHandoffCode, shellHandoffApp } from '@/lib/auth/native-handoff';
import { authOptions } from '@/lib/auth/options';
import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { CURRENT_AGREEMENT_VERSION } from '@/lib/legal/self-employment-acknowledgment';
import { log } from '@/lib/log';
import { currentAgreementHash } from '@/lib/services/agreement.service';
import { AuditService } from '@/lib/services/audit.service';
import { DocumentStorageService } from '@/lib/services/document-storage.service';
import { validatePriceFloors, validateServiceTypePricing } from '@/lib/services/pricing.service';
import { putObject } from '@/lib/storage/r2-client';
import { decodeBase64File, DOCUMENT_MIMES, IMAGE_MIMES } from '@/lib/utils/file-validation';
import { displayName } from '@/lib/utils/name';
import { lookupPostcodeOutcome } from '@/lib/utils/postcode';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

import {
  categoryAllowsPdf,
  firstIncompleteStep,
  isDocCategory,
  LAST_SAVED_STEP,
  parseIsoDate,
  sanitizeDraftData,
  stepErrors,
  type DocCategory,
  type DraftData,
} from './fields';

export const DOB_PURPOSE =
  'Identity and age vetting for right to work and DBS checks (RENA-100, James-ruled 2026-10-08)';
const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type Failure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  step?: number;
  errors?: Record<string, string>;
};
const fail = (status: number, code: string, error: string, extra: Partial<Failure> = {}) =>
  ({ ok: false, status, code, error, ...extra }) as Failure;

// ─── Who is asking ─────────────────────────────────────────────────────────

export type Applicant =
  | { kind: 'ok'; userId: string; sessionJti: string | null }
  | { kind: 'unauthenticated' }
  | { kind: 'not_cleaner' }
  | { kind: 'gone' };

/**
 * The session's applicant. "gone" means the browser still holds a session
 * naming an account that no longer exists (an unfinished application removed
 * by an admin or by expiry): the page shows a terminal state and never
 * recreates it.
 */
export async function resolveApplicant(): Promise<Applicant> {
  const user = await getSessionUser().catch(() => null);
  if (user) {
    return user.role === 'CLEANER'
      ? { kind: 'ok', userId: user.id, sessionJti: user.sessionJti }
      : { kind: 'not_cleaner' };
  }
  const raw = await getServerSession(authOptions).catch(() => null);
  const claimedId = (raw?.user as { id?: string } | undefined)?.id;
  if (claimedId) {
    const exists = await prisma.user.findUnique({
      where: { id: claimedId },
      select: { isDeleted: true },
    });
    if (!exists || exists.isDeleted) return { kind: 'gone' };
  }
  return { kind: 'unauthenticated' };
}

export function applicantFailure(a: Exclude<Applicant, { kind: 'ok' }>): Failure {
  if (a.kind === 'gone') return fail(410, 'APPLICATION_GONE', 'This application no longer exists.');
  if (a.kind === 'not_cleaner')
    return fail(403, 'NOT_A_CLEANER', 'This account is not a cleaner application.');
  return fail(401, 'SIGN_IN_REQUIRED', 'You already started an application. Sign in to continue.');
}

// ─── Reading ───────────────────────────────────────────────────────────────

export interface DraftDocumentView {
  id: string;
  category: DocCategory;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

async function activeDraftDocs(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  return db.documentUpload.findMany({
    where: { userId, reviewState: 'DRAFT', storageState: 'STORED', isDestroyed: false },
    select: { id: true, documentType: true, originalName: true, mimeType: true, fileSize: true },
    orderBy: { createdAt: 'asc' },
  });
}

function storedSet(docs: { documentType: string }[]): Set<DocCategory> {
  return new Set(docs.map((d) => d.documentType).filter(isDocCategory));
}

export async function getApplication(userId: string) {
  const [draft, profile, docs, user] = await Promise.all([
    prisma.cleanerApplicationDraft.findUnique({ where: { userId } }),
    prisma.cleanerProfile.findUnique({ where: { userId }, select: { id: true } }),
    activeDraftDocs(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  // The owner's own account email, so the page can show it (the draft never
  // stores it).
  const account = { email: user?.email ?? '' };
  if (profile) return { status: 'SUBMITTED' as const };
  if (!draft) return { status: 'NONE' as const, account };
  if (draft.status === 'SUBMITTED') return { status: 'SUBMITTED' as const };
  return {
    status: 'IN_PROGRESS' as const,
    account,
    draft: {
      currentStep: draft.currentStep,
      maxReachedStep: draft.maxReachedStep,
      version: draft.version,
      data: sanitizeDraftData(draft.data),
      dateOfBirth: draft.dateOfBirth ? draft.dateOfBirth.toISOString().slice(0, 10) : '',
      lastActivityAt: draft.lastActivityAt.toISOString(),
    },
    documents: docs
      .filter((d) => isDocCategory(d.documentType))
      .map(
        (d): DraftDocumentView => ({
          id: d.id,
          category: d.documentType as DocCategory,
          originalName: d.originalName,
          mimeType: d.mimeType,
          fileSize: d.fileSize,
        })
      ),
  };
}

// ─── Saving a completed step ───────────────────────────────────────────────

export async function saveApplicationStep(
  userId: string,
  input: { version: unknown; completedStep: unknown; data: unknown; dateOfBirth: unknown },
  now: Date = new Date()
): Promise<{ ok: true; version: number; currentStep: number; maxReachedStep: number } | Failure> {
  const version = Number(input.version);
  const completedStep = Number(input.completedStep);
  if (!Number.isInteger(version) || version < 0)
    return fail(400, 'BAD_REQUEST', 'A version is required.');
  if (!Number.isInteger(completedStep) || completedStep < 0 || completedStep > LAST_SAVED_STEP)
    return fail(400, 'BAD_REQUEST', 'Unknown step.');

  const data = sanitizeDraftData(input.data);
  const dobInput = typeof input.dateOfBirth === 'string' ? input.dateOfBirth : '';
  const dob = dobInput ? parseIsoDate(dobInput) : null;
  if (dobInput && !dob)
    return fail(400, 'STEP_INCOMPLETE', 'Enter a real date of birth.', {
      step: 0,
      errors: { dateOfBirth: 'Enter a real date of birth' },
    });

  const [profile, existing, docs] = await Promise.all([
    prisma.cleanerProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.cleanerApplicationDraft.findUnique({ where: { userId } }),
    activeDraftDocs(userId),
  ]);
  if (profile || existing?.status === 'SUBMITTED')
    return fail(409, 'APPLICATION_SUBMITTED', 'This application has already been submitted.');

  const effectiveDob = dob ?? existing?.dateOfBirth ?? null;
  const errors = stepErrors(completedStep, data, {
    storedDocs: storedSet(docs),
    dateOfBirth: effectiveDob,
    now,
  });
  if (Object.keys(errors).length)
    return fail(400, 'STEP_INCOMPLETE', 'Some details on this step need attention.', {
      step: completedStep,
      errors,
    });

  const currentStep = completedStep + 1;
  const json = data as unknown as Prisma.InputJsonValue;

  if (version === 0) {
    if (existing)
      return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');
    try {
      const created = await prisma.cleanerApplicationDraft.create({
        data: {
          userId,
          currentStep,
          maxReachedStep: currentStep,
          data: json,
          dateOfBirth: effectiveDob,
          version: 1,
          lastActivityAt: now,
        },
      });
      return { ok: true, version: created.version, currentStep, maxReachedStep: currentStep };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');
      throw err;
    }
  }

  if (!existing || existing.version !== version)
    return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');
  const maxReachedStep = Math.max(existing.maxReachedStep, currentStep);
  // The version is the guard: this lands only if nobody saved in between.
  const claimed = await prisma.cleanerApplicationDraft.updateMany({
    where: { userId, version, status: 'IN_PROGRESS' },
    data: {
      data: json,
      dateOfBirth: effectiveDob,
      currentStep,
      maxReachedStep,
      version: { increment: 1 },
      lastActivityAt: now,
    },
  });
  if (claimed.count !== 1)
    return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');
  return { ok: true, version: version + 1, currentStep, maxReachedStep };
}

async function touchActivity(userId: string, now: Date) {
  await prisma.cleanerApplicationDraft.updateMany({
    where: { userId, status: 'IN_PROGRESS' },
    data: { lastActivityAt: now },
  });
}

// ─── Draft documents ───────────────────────────────────────────────────────

export async function uploadDraftDocument(
  userId: string,
  input: { category: unknown; fileData: unknown; replaceId?: unknown },
  ctx: { ipAddress?: string; now?: Date } = {}
): Promise<{ ok: true; document: DraftDocumentView } | Failure> {
  const now = ctx.now ?? new Date();
  if (!isDocCategory(input.category)) return fail(400, 'BAD_REQUEST', 'Unknown document type.');
  const category = input.category;
  if (typeof input.fileData !== 'string' || !input.fileData.startsWith('data:'))
    return fail(400, 'BAD_REQUEST', 'Choose a file to upload.');
  const replaceId = typeof input.replaceId === 'string' && input.replaceId ? input.replaceId : null;

  const draft = await prisma.cleanerApplicationDraft.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!draft || draft.status !== 'IN_PROGRESS')
    return fail(409, 'NO_DRAFT', 'Save your details first, then add documents.');

  const check = decodeBase64File(input.fileData, {
    maxSize: MAX_DOC_BYTES,
    allowed: categoryAllowsPdf(category) ? DOCUMENT_MIMES : IMAGE_MIMES,
    typeLabel: categoryAllowsPdf(category) ? 'a JPG, PNG, WebP or PDF file' : 'a JPG or PNG photo',
  });
  if (!check.ok) return fail(400, 'BAD_FILE', check.error);

  // Replacement is explicit: an existing active document is replaced only
  // when the request names it; otherwise the page is stale.
  const current = await prisma.documentUpload.findFirst({
    where: {
      userId,
      documentType: category,
      reviewState: 'DRAFT',
      storageState: 'STORED',
      isDestroyed: false,
    },
    select: { id: true },
  });
  if (current && current.id !== replaceId)
    return fail(409, 'DOCUMENT_CHANGED', 'This document was changed somewhere else.');
  if (!current && replaceId)
    return fail(409, 'DOCUMENT_CHANGED', 'This document was changed somewhere else.');

  const ext = check.mime === 'application/pdf' ? 'pdf' : check.mime.split('/')[1];
  let result;
  try {
    result = await DocumentStorageService.uploadDocument({
      userId,
      documentType: category,
      fileBuffer: check.buffer,
      originalName: `${category}.${ext === 'jpeg' ? 'jpg' : ext}`,
      mimeType: check.mime,
      ipAddress: ctx.ipAddress,
      reviewState: 'DRAFT',
      onStored: async (tx) => {
        if (!current) return null;
        const old = await tx.documentUpload.updateMany({
          where: { id: current.id, userId, reviewState: 'DRAFT', isDestroyed: false },
          data: { isDestroyed: true, destroyedAt: now, destroyedReason: 'replaced' },
        });
        if (old.count !== 1) throw new Error('replacement target moved');
        const row = await tx.documentUpload.findUnique({
          where: { id: current.id },
          select: { storagePath: true },
        });
        return row?.storagePath ?? null;
      },
    });
  } catch (err) {
    if (
      (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
      (err instanceof Error && err.message === 'replacement target moved')
    )
      return fail(409, 'DOCUMENT_CHANGED', 'This document was changed somewhere else.');
    log.error('cleaner_application', 'upload_failed', { userId, category }, err);
    return fail(502, 'UPLOAD_FAILED', 'That upload did not go through. Your progress is saved.');
  }
  await touchActivity(userId, now);
  return {
    ok: true,
    document: {
      id: result.id,
      category,
      originalName: result.originalName,
      mimeType: check.mime,
      fileSize: check.buffer.length,
    },
  };
}

export async function removeDraftDocument(
  userId: string,
  documentId: string,
  now: Date = new Date()
): Promise<{ ok: true } | Failure> {
  const doc = await prisma.documentUpload.findFirst({
    where: { id: documentId, userId, reviewState: 'DRAFT', isDestroyed: false },
    select: { id: true },
  });
  if (!doc) return fail(404, 'NOT_FOUND', 'Document not found.');
  await DocumentStorageService.destroyDocument(doc.id, 'draft_removed_by_applicant', userId);
  await touchActivity(userId, now);
  return { ok: true };
}

/** Owner or admin only; anyone else gets the same 404 as a missing id. */
export async function readApplicationDocument(
  requester: { id: string; role: string },
  documentId: string,
  ipAddress?: string
) {
  const doc = await prisma.documentUpload.findUnique({
    where: { id: documentId },
    select: { userId: true, isDestroyed: true, storageState: true },
  });
  if (!doc || doc.isDestroyed || doc.storageState !== 'STORED') return null;
  if (doc.userId !== requester.id && requester.role !== 'ADMIN') return null;
  return DocumentStorageService.getDocument(documentId, requester.id, ipAddress);
}

// ─── Finalisation ──────────────────────────────────────────────────────────

export type HandoffOutcome =
  | { handoff: 'code'; handoffCode: string; next: null }
  | { handoff: 'none'; next: string };

/** True when this request is already signed into Rena Pro natively. */
async function signedIntoProNatively(sessionJti: string | null): Promise<boolean> {
  if (!sessionJti) return false;
  const row = await prisma.deviceSession.findUnique({
    where: { jti: sessionJti },
    select: { kind: true, parentJti: true },
  });
  return !!row && (row.kind === 'BEARER' || row.parentJti !== null);
}

export interface FinaliseHooks {
  /** Test seam only: runs inside the transaction just before it commits. */
  beforeCommit?: (tx: Prisma.TransactionClient) => Promise<void>;
}

export async function finaliseApplication(
  applicant: { userId: string; sessionJti: string | null },
  input: { version: unknown; agreedToTerms: unknown },
  req: { headers: Headers; ipAddress: string; userAgent?: string },
  hooks: FinaliseHooks = {},
  now: Date = new Date()
): Promise<({ ok: true } & HandoffOutcome) | Failure> {
  const { userId } = applicant;
  if (input.agreedToTerms !== true)
    return fail(400, 'STEP_INCOMPLETE', 'You must agree to continue.', {
      step: 6,
      errors: { agreedToTerms: 'You must agree to continue' },
    });
  const version = Number(input.version);

  const [draft, profile, user, docs] = await Promise.all([
    prisma.cleanerApplicationDraft.findUnique({ where: { userId } }),
    prisma.cleanerProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, createdAt: true },
    }),
    activeDraftDocs(userId),
  ]);
  if (!user) return fail(410, 'APPLICATION_GONE', 'This application no longer exists.');
  if (profile || draft?.status === 'SUBMITTED')
    return fail(409, 'APPLICATION_SUBMITTED', 'This application has already been submitted.');
  if (!draft) return fail(409, 'NO_DRAFT', 'Start your application first.');
  if (draft.version !== version)
    return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');

  const data: DraftData = sanitizeDraftData(draft.data);
  const stored = storedSet(docs);
  const incomplete = firstIncompleteStep(data, {
    storedDocs: stored,
    dateOfBirth: draft.dateOfBirth,
    now,
  });
  if (incomplete)
    return fail(400, 'STEP_INCOMPLETE', 'Some details need attention before you submit.', {
      step: incomplete.step,
      errors: incomplete.errors,
    });
  if (!draft.dateOfBirth)
    return fail(400, 'STEP_INCOMPLETE', 'Date of birth is required.', { step: 0 });

  const pricing = {
    hourlyRateRegular: Number(data.serviceRates.regular) || null,
    hourlyRateDeep: Number(data.serviceRates.deep) || null,
    hourlyRateSameDay: Number(data.serviceRates.same_day) || null,
    eotPrices: null,
    airbnbPrices: null,
  };
  const stp = validateServiceTypePricing(data.serviceTypes, pricing);
  if (!stp.valid)
    return fail(400, 'STEP_INCOMPLETE', stp.error ?? 'Check your rates.', { step: 2 });
  const floor = validatePriceFloors(pricing);
  if (!floor.valid)
    return fail(400, 'STEP_INCOMPLETE', floor.error ?? 'Check your rates.', { step: 2 });

  const postcode = normalizeUkPostcode(data.postcode);
  if (!postcode) return fail(400, 'STEP_INCOMPLETE', 'Enter your full postcode.', { step: 0 });
  const lookup = await lookupPostcodeOutcome(postcode);
  if (lookup.status === 'not_found')
    return fail(400, 'STEP_INCOMPLETE', "We can't find that postcode, check and try again.", {
      step: 0,
      errors: { postcode: "We can't find that postcode" },
    });
  const geo = lookup.status === 'found' ? lookup.result : null;

  // The public profile photo is copied from its encrypted draft document
  // before the transaction (its key is deterministic per user, so a failed
  // finalisation leaves nothing to collect: the next attempt overwrites it).
  let imageKey: string | null = null;
  const photoDoc = docs.find((d) => d.documentType === 'profile_photo');
  if (photoDoc) {
    const file = await DocumentStorageService.getDocument(photoDoc.id, userId, req.ipAddress);
    if (file) {
      const ext = file.mimeType === 'image/jpeg' ? 'jpg' : file.mimeType.split('/')[1];
      imageKey = `profile-photos/${userId}.${ext}`;
      await putObject(imageKey, file.buffer, file.mimeType);
    }
  }

  const name = `${displayName(data.firstName)} ${displayName(data.lastName)}`.trim();
  const maxTravelMinutes = Number(data.maxTravelMinutes);
  const result = await prisma
    .$transaction(async (tx) => {
      // The draft's own CAS: exactly one finalisation of this version wins.
      const claimed = await tx.cleanerApplicationDraft.updateMany({
        where: { userId, version, status: 'IN_PROGRESS' },
        data: { status: 'SUBMITTED', submittedAt: now, version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new FinaliseConflict();
      await tx.user.update({
        where: { id: userId },
        data: {
          role: 'CLEANER',
          name,
          phone: data.phone.trim() || user.phone,
          ...(imageKey ? { image: imageKey } : {}),
        },
      });
      const created = await tx.cleanerProfile.create({
        data: {
          userId,
          bio: data.bio.trim() || null,
          hourlyRateRegular: pricing.hourlyRateRegular,
          hourlyRateDeep: pricing.hourlyRateDeep,
          hourlyRateSameDay: pricing.hourlyRateSameDay,
          specialties: data.specialties,
          languages: data.languages,
          serviceTypes: data.serviceTypes,
          hoursPerWeek: Number(data.hoursPerWeek) || null,
          yearsExperience: data.yearsExperience === '' ? null : Number(data.yearsExperience),
          location: postcode,
          postcode,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          homePostcode: postcode,
          homeLatitude: geo?.latitude ?? null,
          homeLongitude: geo?.longitude ?? null,
          homeGeocodedAt: geo ? now : null,
          maxTravelMinutes,
          radius: 10,
          travelMode: 'public_transport',
          verificationStatus: 'PENDING',
          acknowledgmentVersion: CURRENT_AGREEMENT_VERSION,
          rightToWorkDocType: data.rightToWorkDocType || null,
          rightToWorkShareCode: data.rightToWorkShareCode || null,
          rightToWorkExpiresAt: parseIsoDate(data.rightToWorkExpiryDate),
          dbsCertNumber: data.dbsCertNumber.trim() || null,
          dbsCertIssueDate: parseIsoDate(data.dbsCertIssueDate),
          rightToWorkStatus: data.rightToWorkDocType ? 'PENDING' : 'UNVERIFIED',
          verificationMeta: {
            // H97: provenance is the truth; an upload is not a live capture.
            livenessComplete: data.selfieProvenance !== 'upload' && data.livenessComplete,
            selfieProvenance: data.selfieProvenance || 'unknown',
            dbsOption: data.dbsOption || null,
          },
        },
      });
      await tx.agreementAcceptance.create({
        data: {
          cleanerId: userId,
          agreementVersion: CURRENT_AGREEMENT_VERSION,
          textHash: currentAgreementHash(),
          ipAddress: req.ipAddress,
          userAgent: req.userAgent,
        },
      });
      await tx.cleanerVetting.upsert({
        where: { userId },
        create: { userId, dateOfBirth: draft.dateOfBirth as Date, purpose: DOB_PURPOSE },
        update: { dateOfBirth: draft.dateOfBirth as Date, purpose: DOB_PURPOSE, recordedAt: now },
      });
      await tx.documentUpload.updateMany({
        where: { userId, reviewState: 'DRAFT', storageState: 'STORED', isDestroyed: false },
        data: { reviewState: 'SUBMITTED', profileId: created.id },
      });
      if (hooks.beforeCommit) await hooks.beforeCommit(tx);
      return created;
    })
    .catch((err) => {
      if (err instanceof FinaliseConflict) return null;
      throw err;
    });
  if (!result)
    return fail(409, 'APPLICATION_UPDATED', 'Your application was updated somewhere else.');

  // ─── After commit only ───
  await AuditService.log({
    userId,
    action: 'CLEANER_PROFILE_UPDATED',
    entityType: 'CleanerProfile',
    entityId: result.id,
    metadata: {
      event: 'onboarding_submitted',
      source: 'application_draft',
      dbsOption: data.dbsOption || null,
      documents: Array.from(stored),
    },
  }).catch(() => {});
  try {
    const { triggerCatchmentRefresh } = await import('@/lib/services/catchment-generation.service');
    triggerCatchmentRefresh(userId);
    const { sendSignupNotification } = await import('@/lib/services/email.service');
    sendSignupNotification({
      name,
      email: user.email,
      phone: data.phone.trim(),
      role: 'CLEANER',
      createdAt: user.createdAt.toISOString(),
    }).catch(() => {});
  } catch {
    /* post-commit notifications never undo a committed application */
  }
  log.info('cleaner_application', 'submitted', { userId });

  if (await signedIntoProNatively(applicant.sessionJti)) {
    return { ok: true, handoff: 'none', next: '/app/today' };
  }
  if (shellHandoffApp(req.headers, 'CLEANER') === 'PRO') {
    const handoffCode = await mintNativeHandoffCode({ userId, role: 'CLEANER', app: 'PRO' });
    return { ok: true, handoff: 'code', handoffCode, next: null };
  }
  return { ok: true, handoff: 'none', next: '/cleaner' };
}

class FinaliseConflict extends Error {}
