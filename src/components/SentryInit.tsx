'use client';

// F15: client-side Sentry, initialised once on mount. Gated on
// NEXT_PUBLIC_SENTRY_DSN — dormant without it. Mounted in the root layout so
// browser errors (including unhandled rejections) report. We deliberately do
// NOT wrap next.config in withSentryConfig: builds stay untouched (no
// sourcemap upload); stack traces are minified but grouped correctly.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import { sentryScrubOptions } from '@/lib/sentry-scrub';

let initialised = false;

export default function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn || initialised) return;
    initialised = true;
    // RENA-066 (B1b): error monitoring only, outside analytics consent by
    // ruling, with the shared scrubber and no console breadcrumbs.
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
      ...sentryScrubOptions,
      integrations: (defaults) => [
        ...defaults.filter((i) => i.name !== 'Breadcrumbs'),
        Sentry.breadcrumbsIntegration({ console: false }),
      ],
    });
  }, []);
  return null;
}
