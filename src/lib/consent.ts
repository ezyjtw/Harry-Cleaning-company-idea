// RENA-059 (D-b, B1b, James-ruled): the one consent gate. The cookie banner,
// the in-shell ask, the analytics hook and the settings doors all read and
// write consent here. Nothing analytics-related happens (no session id write,
// no event, no unload beacon, no funnel mount event) unless analyticsAllowed()
// is true.
//
// Precedence (ruled):
//   Signed-in   the GdprConsent ledger is authoritative. It is read once per
//               account (GET /api/gdpr/consent), cached locally under a key
//               that carries the user id and the policy version, and asked
//               once per account when absent. An anonymous "yes" in this
//               browser never silently becomes the account's answer.
//   Anonymous   localStorage (rena_cookie_consent, the banner's existing key).
//   Unknown     while the session is still resolving, nothing is allowed;
//               analytics calls made in that window wait in memory and are
//               sent only if the resolved answer allows them, else discarded.

export const CONSENT_POLICY_VERSION = '1.0';
export const ANON_CONSENT_KEY = 'rena_cookie_consent';

export interface ConsentPreferences {
  essential: true;
  analytics: boolean;
  marketing: boolean;
}

type Mode = 'unknown' | 'anonymous' | 'account';

interface ConsentState {
  mode: Mode;
  userId: string | null;
  /** Account answer: undefined = not loaded yet, null = loaded and absent. */
  account: ConsentPreferences | null | undefined;
}

let state: ConsentState = { mode: 'unknown', userId: null, account: undefined };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a listener never breaks the gate */
    }
  });
}

export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function accountConsentKey(userId: string): string {
  return `rena_consent:${userId}:${CONSENT_POLICY_VERSION}`;
}

function parse(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CONSENT_POLICY_VERSION || !parsed.preferences) return null;
    return {
      essential: true,
      analytics: parsed.preferences.analytics === true,
      marketing: parsed.preferences.marketing === true,
    };
  } catch {
    return null;
  }
}

function serialise(prefs: ConsentPreferences): string {
  return JSON.stringify({
    version: CONSENT_POLICY_VERSION,
    preferences: prefs,
    timestamp: new Date().toISOString(),
  });
}

export function readAnonymousConsent(): ConsentPreferences | null {
  return parse(storage()?.getItem(ANON_CONSENT_KEY) ?? null);
}

export function readAccountCache(userId: string): ConsentPreferences | null {
  return parse(storage()?.getItem(accountConsentKey(userId)) ?? null);
}

function writeAccountCache(userId: string, prefs: ConsentPreferences): void {
  try {
    storage()?.setItem(accountConsentKey(userId), serialise(prefs));
  } catch {
    /* storage refused: the ledger stays authoritative */
  }
}

/**
 * Tell the gate who is browsing. null = signed out; a user id = signed in.
 * Called by the consent sync in CookieConsent once the session resolves.
 */
export function setConsentIdentity(userId: string | null): void {
  if (userId === null) {
    if (state.mode === 'anonymous') return;
    state = { mode: 'anonymous', userId: null, account: undefined };
  } else {
    if (state.mode === 'account' && state.userId === userId) return;
    const cached = readAccountCache(userId);
    state = { mode: 'account', userId, account: cached ?? undefined };
  }
  notify();
}

/** The current answer for the current identity, or null when there is none (yet). */
export function currentConsent(): ConsentPreferences | null {
  if (state.mode === 'anonymous') return readAnonymousConsent();
  if (state.mode === 'account') return state.account ?? null;
  return null;
}

export function consentMode(): Mode {
  return state.mode;
}

/** True only when the account answer has been loaded and found absent. */
export function accountAnswerMissing(): boolean {
  return state.mode === 'account' && state.account === null;
}

export function analyticsAllowed(): boolean {
  return currentConsent()?.analytics === true;
}

/** Whether the identity is still resolving (analytics calls wait, never send). */
export function consentPending(): boolean {
  return state.mode === 'unknown' || (state.mode === 'account' && state.account === undefined);
}

/**
 * Load the signed-in account's answer from the ledger (once per account per
 * page life when no local cache exists). A ledger row from another policy
 * version counts as absent.
 */
export async function loadAccountConsent(userId: string): Promise<ConsentPreferences | null> {
  if (state.mode !== 'account' || state.userId !== userId) return null;
  if (state.account !== undefined) return state.account;
  let prefs: ConsentPreferences | null = null;
  try {
    const res = await fetch('/api/gdpr/consent', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as {
        status?: Record<string, { granted: boolean; version?: string }>;
      };
      const analytics = data.status?.analytics;
      if (analytics && (analytics.version ?? '1.0') === CONSENT_POLICY_VERSION) {
        prefs = {
          essential: true,
          analytics: analytics.granted === true,
          marketing: data.status?.marketing?.granted === true,
        };
      }
    } else {
      // Not readable (signed out mid-flight, server error): treat as absent
      // for this page life so nothing fires; the ask can be answered.
      prefs = null;
    }
  } catch {
    prefs = null;
  }
  if (state.mode === 'account' && state.userId === userId) {
    state = { ...state, account: prefs };
    if (prefs) writeAccountCache(userId, prefs);
    notify();
  }
  return prefs;
}

/**
 * Record a choice for the current identity. Signed in: the ledger (the server
 * binds the row to the session user) plus the per-account cache; the
 * anonymous key is left alone. Signed out: the anonymous key plus the
 * existing anonymous ledger row.
 */
export async function saveConsent(prefs: Omit<ConsentPreferences, 'essential'>): Promise<void> {
  const full: ConsentPreferences = {
    essential: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
  };
  if (state.mode === 'account' && state.userId) {
    const userId = state.userId;
    state = { ...state, account: full };
    writeAccountCache(userId, full);
  } else {
    try {
      storage()?.setItem(ANON_CONSENT_KEY, serialise(full));
    } catch {
      /* storage refused: this page life still honours the choice below */
    }
    if (state.mode === 'unknown') state = { mode: 'anonymous', userId: null, account: undefined };
  }
  notify();
  await fetch('/api/gdpr/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'anonymous@cookie-consent',
      version: CONSENT_POLICY_VERSION,
      consents: [
        { type: 'essential', granted: true },
        { type: 'analytics', granted: full.analytics },
        { type: 'marketing', granted: full.marketing },
      ],
    }),
  }).catch(() => {});
}

/** Test hook. */
export function resetConsentForTests(): void {
  state = { mode: 'unknown', userId: null, account: undefined };
  listeners.clear();
}
