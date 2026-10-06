// RENA-066 (D-l, B1b): the one bounded redactor, shared by the server logger
// and the Sentry scrubber (browser and server). Pure, no Node modules, so it
// runs in every runtime. It never decides what may be logged (the logger's
// allowlist does); it only scrubs the free text that survives: error messages,
// capped string values, exception values sent to Sentry.

export const REDACT_MAX = 200;

const PATTERNS: Array<[RegExp, string]> = [
  // Bearer tokens and JWT-shaped strings.
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [token]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  // Provider secrets and keys (Stripe, webhook, Resend, generic sk_/pk_/rk_).
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{6,}\b/g, '[key]'],
  [/\bwhsec_[A-Za-z0-9]{6,}\b/g, '[key]'],
  [/\bre_[A-Za-z0-9]{12,}\b/g, '[key]'],
  // Stripe client secrets (pi_..._secret_...).
  [/\b(?:pi|seti|cs)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+\b/g, '[client-secret]'],
  // Email addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // URL query strings (keep the path, drop everything after '?').
  [/(https?:\/\/[^\s?#]+)\?[^\s#]*/gi, '$1?[query]'],
  // Long digit runs (card-like or account-like numbers), before phones.
  [/\b\d{12,19}\b/g, '[number]'],
  // UK postcodes.
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '[postcode]'],
  // Phone numbers: a + or 0 lead and nine or more digits with separators.
  [/(?:\+\d{1,3}[\s-]?)?\(?0?\d{2,5}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, '[phone]'],
];

/** Scrub free text and cap it. Non-strings are stringified first. */
export function redactText(input: unknown, max: number = REDACT_MAX): string {
  let text: string;
  if (typeof input === 'string') text = input;
  else if (input === null || input === undefined) text = '';
  else {
    try {
      text = String(input);
    } catch {
      text = '[unprintable]';
    }
  }
  // Only the first line: stacks and multi-line payloads never travel.
  text = text.split('\n')[0];
  for (const [pattern, replacement] of PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
