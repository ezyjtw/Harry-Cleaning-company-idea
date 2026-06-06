export async function register() {
  // Only run on the Node.js server runtime, not the Edge runtime
  // (document-encryption.ts uses Node's crypto module)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/config/env');
    const { validateEncryptionConfig } = await import('@/lib/utils/document-encryption');

    const envResult = validateEnvironment();
    if (!envResult.valid) {
      for (const error of envResult.errors) {
        // eslint-disable-next-line no-console
        console.error(`[Boot] ${error}`);
      }
      throw new Error(
        `Server startup blocked: ${envResult.errors.length} missing or invalid environment variable(s). See logs above.`
      );
    }

    for (const warning of envResult.warnings) {
      // eslint-disable-next-line no-console
      console.warn(`[Boot] ${warning}`);
    }

    const encryptionResult = validateEncryptionConfig();
    if (!encryptionResult.valid) {
      throw new Error(
        `Server startup blocked: document encryption validation failed — ${encryptionResult.error}`
      );
    }

    const { checkReferenceDataIntegrity } = await import('@/lib/db/reference-data-check');
    await checkReferenceDataIntegrity();
  }
}
