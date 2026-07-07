import * as Sentry from '@sentry/nextjs';

export async function register() {
  // F15: REAL Sentry (server + edge). Dormant without SENTRY_DSN — set it in
  // Railway to activate. No build-plugin wrapping (no sourcemap upload) — the
  // capture itself is fully live.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0, // errors only — no performance quota burn
    });
  }

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

// F15: captures errors from React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
