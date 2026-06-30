import crypto from 'crypto';

// A11c: stateless, signed unsubscribe tokens for marketing emails (PECR).
// token = base64url(userId) + "." + base64url(HMAC-SHA256(userId)). No DB row
// needed — the signature proves the link came from us, so a recipient can
// one-click unsubscribe without logging in. Keyed on NEXTAUTH_SECRET (always set).

const SECRET = process.env.NEXTAUTH_SECRET || '';

function sign(userId: string): string {
  return crypto.createHmac('sha256', SECRET).update(userId).digest('base64url');
}

export function generateUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId, 'utf8').toString('base64url');
  return `${payload}.${sign(userId)}`;
}

/** Returns the userId if the token is authentic, otherwise null. */
export function verifyUnsubscribeToken(token: string): string | null {
  if (!SECRET) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let userId: string;
  try {
    userId = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;

  const expectedSig = sign(userId);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return userId;
}
