import { validateEnvironment } from '@/lib/config/env';
import { validateEncryptionConfig } from '@/lib/utils/document-encryption';

export async function register() {
  const envResult = validateEnvironment();
  if (!envResult.valid) {
    for (const error of envResult.errors) {
      console.error(`[Boot] ${error}`);
    }
    throw new Error(
      `Server startup blocked: ${envResult.errors.length} missing or invalid environment variable(s). See logs above.`
    );
  }

  for (const warning of envResult.warnings) {
    console.warn(`[Boot] ${warning}`);
  }

  const encryptionResult = validateEncryptionConfig();
  if (!encryptionResult.valid) {
    throw new Error(
      `Server startup blocked: document encryption validation failed — ${encryptionResult.error}`
    );
  }
}
