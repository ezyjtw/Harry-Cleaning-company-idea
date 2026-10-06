// RENA-020 (B2a, James-ruled amendment 3): one callbackUrl sanitiser for
// login and signup. Only a same-origin relative destination survives:
// a path that starts with a single "/", carries no backslash, no control
// character and no scheme, and still resolves to the same origin. Anything
// else ("//evil.com", "/\\evil.com", "https://evil.com", "javascript:...")
// returns null and the caller falls back to its role home.
const PROBE_ORIGIN = 'https://rena.invalid';

export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\')) return null;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== PROBE_ORIGIN) return null;
  return parsed.pathname + parsed.search + parsed.hash;
}
