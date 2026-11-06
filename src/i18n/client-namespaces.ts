// RENA-086 (B6.7, James-ruled): the locale layout's NextIntlClientProvider
// sends only the namespaces client components read, not the whole catalogue.
// Server components read their own (Metadata, Reviews) from the request config.
// src/lib/ci/client-namespaces.test.ts keeps this list equal to the
// useTranslations namespaces found in client components.
export const CLIENT_NAMESPACES = [
  'CleanerCTA',
  'Cookie',
  'Footer',
  'FooterCTA',
  'Guarantees',
  'Hero',
  'HowItWorks',
  'Nav',
  'Services',
  'Stats',
] as const;

export function pickClientMessages(messages: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]])
  );
}
