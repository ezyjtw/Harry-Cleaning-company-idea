import { describe, expect, it } from 'vitest';

import { validateBackupCleanerFields, isValidationError } from './backup-cleaner-validation';

const CLEANER_A = 'user_cleaner_a';
const CLEANER_B = 'user_cleaner_b';
const CLEANER_C = 'user_cleaner_c';
const CLEANER_D = 'user_cleaner_d';
const PRIMARY = 'user_primary';

const ALL_CLEANERS = new Set([CLEANER_A, CLEANER_B, CLEANER_C, CLEANER_D, PRIMARY]);

describe('validateBackupCleanerFields', () => {
  it('stores backupCleanerIds and autoAssignBackup correctly', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, CLEANER_B],
        autoAssignBackup: true,
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([CLEANER_A, CLEANER_B]);
      expect(result.autoAssignBackup).toBe(true);
    }
  });

  it('defaults omitted fields to [] and false (no-backups case)', () => {
    const result = validateBackupCleanerFields({ primaryCleanerId: PRIMARY }, ALL_CLEANERS);
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([]);
      expect(result.autoAssignBackup).toBe(false);
    }
  });

  it('allows autoAssignBackup: true with empty backupCleanerIds', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [],
        autoAssignBackup: true,
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([]);
      expect(result.autoAssignBackup).toBe(true);
    }
  });

  it('allows autoAssignBackup: true with undefined backupCleanerIds', () => {
    const result = validateBackupCleanerFields(
      {
        autoAssignBackup: true,
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([]);
      expect(result.autoAssignBackup).toBe(true);
    }
  });

  it('rejects primary cleaner in backup array', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, PRIMARY],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(true);
    if (isValidationError(result)) {
      expect(result.error).toContain('Primary cleaner cannot be in the backup list');
    }
  });

  it('rejects more than 3 backups', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, CLEANER_B, CLEANER_C, CLEANER_D],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(true);
    if (isValidationError(result)) {
      expect(result.error).toContain('Maximum 3 backup cleaners');
    }
  });

  it('rejects duplicate IDs', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, CLEANER_A],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(true);
    if (isValidationError(result)) {
      expect(result.error).toContain('Duplicate');
    }
  });

  it('rejects non-existent cleaner ID', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, 'nonexistent_id'],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(true);
    if (isValidationError(result)) {
      expect(result.error).toContain('nonexistent_id');
    }
  });

  it('treats non-array backupCleanerIds as empty', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: 'not-an-array',
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([]);
    }
  });

  it('treats non-boolean autoAssignBackup as false', () => {
    const result = validateBackupCleanerFields(
      {
        autoAssignBackup: 'yes',
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.autoAssignBackup).toBe(false);
    }
  });

  it('accepts exactly 3 valid backup cleaners', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_A, CLEANER_B, CLEANER_C],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toHaveLength(3);
    }
  });

  it('preserves order of backup cleaner IDs', () => {
    const result = validateBackupCleanerFields(
      {
        backupCleanerIds: [CLEANER_C, CLEANER_A, CLEANER_B],
        primaryCleanerId: PRIMARY,
      },
      ALL_CLEANERS
    );
    expect(isValidationError(result)).toBe(false);
    if (!isValidationError(result)) {
      expect(result.backupCleanerIds).toEqual([CLEANER_C, CLEANER_A, CLEANER_B]);
    }
  });
});
