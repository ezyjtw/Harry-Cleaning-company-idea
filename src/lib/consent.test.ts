import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANON_CONSENT_KEY,
  accountAnswerMissing,
  accountConsentKey,
  analyticsAllowed,
  consentPending,
  currentConsent,
  loadAccountConsent,
  resetConsentForTests,
  saveConsent,
  setConsentIdentity,
} from './consent';

// RENA-059 (D-b, B1b): the precedence rules of the consent gate.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  keys() {
    return Array.from(this.m.keys());
  }
}

let store: MemoryStorage;
const fetchMock = vi.fn();

function anonYes() {
  store.setItem(
    ANON_CONSENT_KEY,
    JSON.stringify({
      version: '1.0',
      preferences: { essential: true, analytics: true, marketing: true },
    })
  );
}

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: store });
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  resetConsentForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consent gate', () => {
  it('allows nothing while the identity is unknown, even with an anonymous yes stored', () => {
    anonYes();
    expect(consentPending()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  });

  it('anonymous: localStorage decides; absent means not allowed', () => {
    setConsentIdentity(null);
    expect(analyticsAllowed()).toBe(false);
    expect(currentConsent()).toBeNull();
    anonYes();
    expect(analyticsAllowed()).toBe(true);
  });

  it('an anonymous yes never silently becomes the account answer', async () => {
    anonYes();
    setConsentIdentity('u1');
    expect(consentPending()).toBe(true);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: {} }) });
    await loadAccountConsent('u1');
    expect(accountAnswerMissing()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
    expect(store.getItem(accountConsentKey('u1'))).toBeNull();
  });

  it('signed-in: the ledger is authoritative and cached by user id and policy version', async () => {
    setConsentIdentity('u1');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: {
          analytics: { granted: true, version: '1.0' },
          marketing: { granted: false, version: '1.0' },
        },
      }),
    });
    await loadAccountConsent('u1');
    expect(analyticsAllowed()).toBe(true);
    expect(store.getItem('rena_consent:u1:1.0')).toContain('"analytics":true');
    // A later page life reads the cache without a fetch.
    resetConsentForTests();
    fetchMock.mockClear();
    setConsentIdentity('u1');
    expect(analyticsAllowed()).toBe(true);
    await loadAccountConsent('u1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a ledger answer from another policy version counts as absent', async () => {
    setConsentIdentity('u1');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { analytics: { granted: true, version: '0.9' } } }),
    });
    await loadAccountConsent('u1');
    expect(accountAnswerMissing()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  });

  it('a failed ledger read allows nothing', async () => {
    setConsentIdentity('u1');
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await loadAccountConsent('u1');
    expect(analyticsAllowed()).toBe(false);
  });

  it('signed-in save writes the ledger and the account cache, never the anonymous key', async () => {
    setConsentIdentity('u1');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: {} }) });
    await loadAccountConsent('u1');
    await saveConsent({ analytics: true, marketing: false });
    expect(analyticsAllowed()).toBe(true);
    expect(store.getItem(ANON_CONSENT_KEY)).toBeNull();
    expect(store.getItem(accountConsentKey('u1'))).toContain('"analytics":true');
    const body = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body);
    expect(body.version).toBe('1.0');
    expect(body.consents).toContainEqual({ type: 'analytics', granted: true });
  });

  it('switching accounts never carries one account answer to another', async () => {
    store.setItem(
      accountConsentKey('u1'),
      JSON.stringify({ version: '1.0', preferences: { analytics: true, marketing: false } })
    );
    setConsentIdentity('u1');
    expect(analyticsAllowed()).toBe(true);
    setConsentIdentity('u2');
    expect(analyticsAllowed()).toBe(false);
    expect(consentPending()).toBe(true);
  });

  it('anonymous save writes only the anonymous key', async () => {
    setConsentIdentity(null);
    await saveConsent({ analytics: false, marketing: false });
    expect(store.keys()).toEqual([ANON_CONSENT_KEY]);
    expect(analyticsAllowed()).toBe(false);
  });
});
