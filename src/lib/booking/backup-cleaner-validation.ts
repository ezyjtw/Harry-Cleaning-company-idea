/**
 * Validates backup cleaner fields for the booking POST handler.
 * Extracted for testability — the actual DB lookups are injected via the
 * `lookupCleanerProfiles` parameter.
 */

export interface BackupCleanerInput {
  backupCleanerIds?: unknown;
  autoAssignBackup?: unknown;
  primaryCleanerId: string;
}

export interface BackupCleanerResult {
  backupCleanerIds: string[];
  autoAssignBackup: boolean;
}

export interface ValidationError {
  error: string;
}

export function validateBackupCleanerFields(
  input: BackupCleanerInput,
  existingCleanerUserIds: Set<string>
): BackupCleanerResult | ValidationError {
  const backupCleanerIds: string[] = Array.isArray(input.backupCleanerIds)
    ? input.backupCleanerIds
    : [];
  const autoAssignBackup: boolean = input.autoAssignBackup === true;

  if (backupCleanerIds.length > 3) {
    return { error: 'Maximum 3 backup cleaners allowed.' };
  }

  if (backupCleanerIds.length > 0) {
    if (new Set(backupCleanerIds).size !== backupCleanerIds.length) {
      return { error: 'Duplicate backup cleaner IDs are not allowed.' };
    }

    if (backupCleanerIds.includes(input.primaryCleanerId)) {
      return { error: 'Primary cleaner cannot be in the backup list.' };
    }

    const missing = backupCleanerIds.filter((id) => !existingCleanerUserIds.has(id));
    if (missing.length > 0) {
      return { error: `Invalid backup cleaner IDs: ${missing.join(', ')}` };
    }
  }

  return { backupCleanerIds, autoAssignBackup };
}

export function isValidationError(
  result: BackupCleanerResult | ValidationError
): result is ValidationError {
  return 'error' in result;
}
