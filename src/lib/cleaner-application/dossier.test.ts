import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import IncompleteSignupClient from '@/app/[locale]/admin/cleaners/[id]/IncompleteSignupClient';
import type { IncompleteSignupDetail } from '@/app/[locale]/admin/cleaners/[id]/page';

import { applicationDossier, type DraftForDossier } from './dossier';

// RENA-103 (James-ruled 2026-10-08): the dossier shows the authoritative saved
// application; the analytics trail stays only for pre-draft accounts, as an
// estimate. Synthetic data only.
const DAY = 86400000;
const RULE = { sweepAgeDays: 30, warningWindowDays: 3 };
const created = new Date('2026-09-01T09:00:00.000Z');
const draft = (o: Partial<DraftForDossier> = {}): DraftForDossier => ({
  status: 'IN_PROGRESS',
  currentStep: 3,
  maxReachedStep: 4,
  lastActivityAt: new Date('2026-09-10T12:00:00.000Z'),
  expiryReminderSentAt: null,
  expiryReminderAttemptAt: null,
  expiryReminderFailures: 0,
  ...o,
});

describe('applicationDossier', () => {
  it('numbers steps as the applicant sees them, bounded to 1..7', () => {
    expect(applicationDossier(draft(), created, RULE)).toMatchObject({
      savedStep: 4,
      furthestStep: 5,
      stepCount: 7,
    });
    expect(
      applicationDossier(draft({ currentStep: 0, maxReachedStep: 0 }), created, RULE).savedStep
    ).toBe(1);
    expect(
      applicationDossier(draft({ currentStep: 9, maxReachedStep: 9 }), created, RULE).savedStep
    ).toBe(7);
  });

  it('no warning delivered: no removal date (the sweep waits for one)', () => {
    const d = applicationDossier(draft(), created, RULE);
    expect(d.warning).toEqual({ state: 'not_sent' });
    expect(d.removalNoSoonerThan).toBeNull();
  });

  it('failed sends show as undelivered with the count and last attempt, still no date', () => {
    const at = new Date('2026-10-07T08:00:00.000Z');
    const d = applicationDossier(
      draft({ expiryReminderFailures: 2, expiryReminderAttemptAt: at }),
      created,
      RULE
    );
    expect(d.warning).toEqual({
      state: 'undelivered',
      failures: 2,
      lastAttemptAt: at.toISOString(),
    });
    expect(d.removalNoSoonerThan).toBeNull();
  });

  it('delivered: the latest of 30 days from creation, 30 idle days, and the 3 day window', () => {
    const sent = new Date('2026-10-08T10:00:00.000Z');
    const d = applicationDossier(draft({ expiryReminderSentAt: sent }), created, RULE);
    expect(d.warning).toEqual({ state: 'delivered', at: sent.toISOString() });
    expect(d.removalNoSoonerThan).toBe(new Date(sent.getTime() + 3 * DAY).toISOString());
    const recent = draft({
      lastActivityAt: new Date('2026-10-01T00:00:00.000Z'),
      expiryReminderSentAt: sent,
    });
    expect(applicationDossier(recent, created, RULE).removalNoSoonerThan).toBe(
      new Date(new Date('2026-10-01T00:00:00.000Z').getTime() + 30 * DAY).toISOString()
    );
  });
});

describe('applicationDossier documents (James-ruled 23 Oct)', () => {
  it('every category with its draft state: uploaded, upload not finished, not uploaded', () => {
    const d = applicationDossier(draft(), created, RULE, [
      { documentType: 'photo_id', storageState: 'STORED' },
      { documentType: 'selfie', storageState: 'PENDING' },
      { documentType: 'right_to_work', storageState: 'PENDING' },
      { documentType: 'right_to_work', storageState: 'STORED' },
      { documentType: 'not_a_category', storageState: 'STORED' },
    ]);
    expect(d.documents).toEqual([
      { category: 'photo_id', label: 'Photo ID', state: 'uploaded' },
      { category: 'right_to_work', label: 'Right to work', state: 'uploaded' },
      { category: 'dbs_certificate', label: 'DBS certificate', state: 'missing' },
      { category: 'selfie', label: 'Selfie', state: 'uploading' },
      { category: 'profile_photo', label: 'Profile photo', state: 'missing' },
    ]);
  });

  it('a deleted object never counts as uploaded', () => {
    const d = applicationDossier(draft(), created, RULE, [
      { documentType: 'photo_id', storageState: 'DELETED' },
    ]);
    expect(d.documents[0]).toMatchObject({ category: 'photo_id', state: 'missing' });
  });
});

describe('the dossier view (render)', () => {
  const base: IncompleteSignupDetail = {
    userId: 'u1',
    name: 'Rig Applicant',
    email: 'rig@integration.invalid',
    phone: null,
    createdAt: created.toISOString(),
    accountStatus: 'ACTIVE',
    isSuspended: false,
    emailVerified: null,
    verifyTokenExpires: null,
    sweepAt: new Date(created.getTime() + 30 * DAY).toISOString(),
    sweepExempt: false,
    application: null,
    funnel: { matchedSessions: 1, furthestStepIndex: 2, lastActivityAt: null, steps: [] },
  };
  const html = (signup: IncompleteSignupDetail) =>
    renderToStaticMarkup(createElement(IncompleteSignupClient, { signup }));

  it('with a draft: the saved step, the warning state and no analytics estimate', () => {
    const out = html({
      ...base,
      application: applicationDossier(
        draft({
          expiryReminderFailures: 1,
          expiryReminderAttemptAt: new Date('2026-10-07T08:00:00Z'),
        }),
        created,
        RULE
      ),
    });
    expect(out).toContain('Saved application');
    expect(out).toContain('Step 4 of 7 · Identity');
    expect(out).toContain('Step 5 of 7 · DBS Check');
    expect(out).toContain('Warning undelivered, 1 failed attempt');
    expect(out).toContain('not before a deletion warning has been delivered, then 3 days');
    expect(out).not.toContain('Estimate:');
    expect(out).not.toContain('(30-day sweep)');
  });

  it('without a draft: the analytics trail, labelled as an estimate', () => {
    const out = html(base);
    expect(out).toContain('Wizard progress (estimate)');
    expect(out).toContain('Estimate: this account started before applications were saved');
    expect(out).toContain('(30-day sweep)');
    expect(out).not.toContain('Saved application');
    expect(out).not.toContain('data-testid="deletion-warning"');
    expect(out).toContain('documents are uploaded at the final Review step');
  });

  it('with uploads: each category and its state, never "None"', () => {
    const out = html({
      ...base,
      application: applicationDossier(draft(), created, RULE, [
        { documentType: 'photo_id', storageState: 'STORED' },
        { documentType: 'selfie', storageState: 'PENDING' },
      ]),
    });
    expect(out).toContain('data-testid="draft-documents"');
    expect(out).toMatch(/Photo ID<\/span><span[^>]*>✓ Uploaded/);
    expect(out).toMatch(/Selfie<\/span><span[^>]*>Upload not finished/);
    expect(out).toMatch(/Right to work<\/span><span[^>]*>Not uploaded/);
    expect(out).not.toContain('documents are uploaded at the final Review step');
  });
});
