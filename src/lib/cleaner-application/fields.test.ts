import { describe, expect, it } from 'vitest';

import {
  ageOn,
  firstIncompleteStep,
  parseIsoDate,
  requiredCategories,
  sanitizeDraftData,
  stepErrors,
  type DocCategory,
} from './fields';

// RENA-100/101: the server's own wizard rules (pure).
const NOW = new Date('2026-10-08T12:00:00Z');
const base = sanitizeDraftData({
  firstName: 'Rig',
  lastName: 'Applicant',
  phone: '07700900123',
  postcode: 'e46ap',
  yearsExperience: '5',
  serviceTypes: ['regular'],
  languages: ['English'],
  bio: 'Bio',
  serviceRates: { regular: '18' },
  hoursPerWeek: '20',
  maxTravelMinutes: '30',
  rightToWorkDocType: 'uk_passport',
  dbsOption: 'none',
  selfieProvenance: 'capture',
  acknowledgeSelfEmployment: true,
});
const ALL: ReadonlySet<DocCategory> = new Set<DocCategory>(['photo_id', 'right_to_work', 'selfie']);
const ctx = (over: Partial<Parameters<typeof stepErrors>[2]> = {}) => ({
  storedDocs: ALL,
  dateOfBirth: new Date('1990-04-06T00:00:00Z'),
  now: NOW,
  ...over,
});

describe('application fields (RENA-100)', () => {
  it('drops unknown keys, the password and the email; bounds strings and arrays', () => {
    const d = sanitizeDraftData({
      password: 'x',
      email: 'a@b.invalid',
      evil: 1,
      bio: 'x'.repeat(5000),
      languages: Array(50)
        .fill('English')
        .map((l, i) => `${l}${i}`),
      serviceRates: { regular: '18', hacker: '1' },
    }) as unknown as Record<string, unknown>;
    expect(d.password).toBeUndefined();
    expect(d.email).toBeUndefined();
    expect(d.evil).toBeUndefined();
    expect((d.bio as string).length).toBe(2000);
    expect((d.languages as string[]).length).toBe(20);
    expect(d.serviceRates).toEqual({ regular: '18' });
  });

  it('a complete draft has no incomplete step', () => {
    expect(firstIncompleteStep(base, ctx())).toBeNull();
  });

  it.each([
    ['under 18', 0, { dateOfBirth: new Date('2010-01-01T00:00:00Z') }, 'dateOfBirth'],
    ['no date of birth', 0, { dateOfBirth: null }, 'dateOfBirth'],
    [
      'no photo ID stored',
      3,
      { storedDocs: new Set<DocCategory>(['right_to_work', 'selfie']) },
      'photoIdFile',
    ],
    [
      'no selfie stored',
      4,
      { storedDocs: new Set<DocCategory>(['photo_id', 'right_to_work']) },
      'selfiePhoto',
    ],
  ] as const)('refuses %s at step %i', (_l, step, over, field) => {
    expect(stepErrors(step, base, ctx(over as never))).toHaveProperty(field);
  });

  it('an existing DBS needs a 12 digit number, a recent date and the certificate', () => {
    const d = {
      ...base,
      dbsOption: 'existing',
      dbsCertNumber: '123',
      dbsCertIssueDate: '2020-01-01',
    };
    const e = stepErrors(4, d, ctx());
    expect(Object.keys(e).sort()).toEqual(['dbsCertFile', 'dbsCertIssueDate', 'dbsCertNumber']);
    expect(requiredCategories(d)).toContain('dbs_certificate');
  });

  it('rates hold the £14 to £100 band; travel 5 to 120', () => {
    expect(stepErrors(2, { ...base, serviceRates: { regular: '13' } }, ctx())).toHaveProperty(
      'rate_regular'
    );
    expect(stepErrors(2, { ...base, maxTravelMinutes: '121' }, ctx())).toHaveProperty(
      'maxTravelMinutes'
    );
  });

  it('dates: real calendar days only; age by birthday', () => {
    expect(parseIsoDate('1990-02-31')).toBeNull();
    expect(parseIsoDate('1990-02-28')?.toISOString()).toBe('1990-02-28T00:00:00.000Z');
    expect(ageOn(new Date('2008-10-09T00:00:00Z'), NOW)).toBe(17);
    expect(ageOn(new Date('2008-10-08T00:00:00Z'), NOW)).toBe(18);
  });
});
