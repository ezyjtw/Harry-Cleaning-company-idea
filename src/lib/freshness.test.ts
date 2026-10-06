import { describe, expect, it } from 'vitest';

import {
  clearAllStale,
  COALESCE_MS,
  type FreshnessEnv,
  markStale,
  registerPane,
  STALE_MAX_AGE_MS,
  staleKey,
} from './freshness';

// RENA-018 / RENA-025 (B2a): the freshness contract in node, with an injected
// window, document, storage and clock.
function target() {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    addEventListener(type: string, fn: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string, e: unknown = {}) {
      for (const fn of Array.from(listeners.get(type) ?? [])) fn(e);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    map: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    get length() {
      return m.size;
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  };
}

function makeEnv(storage = memoryStorage(), start = 1_000_000) {
  const clock = { t: start };
  const w = Object.assign(target(), {}) as ReturnType<typeof target> & Record<string, unknown>;
  const d = Object.assign(target(), { visibilityState: 'visible' });
  const env: FreshnessEnv = {
    window: w,
    document: d,
    storage,
    now: () => clock.t,
  };
  return { env, w, d, storage, clock };
}

describe('freshness contract (RENA-018, RENA-025)', () => {
  it('refetches on activation at most once per 15 s', () => {
    const { env, d, clock } = makeEnv();
    let n = 0;
    registerPane('home', () => (n += 1), env);
    d.fire('visibilitychange');
    expect(n).toBe(0); // the mount load counts as the latest fetch
    clock.t += COALESCE_MS - 1;
    d.fire('visibilitychange');
    expect(n).toBe(0);
    clock.t += 1;
    d.fire('visibilitychange');
    expect(n).toBe(1);
    clock.t += 1000;
    d.fire('visibilitychange');
    expect(n).toBe(1);
  });

  it('ignores visibilitychange while hidden', () => {
    const { env, d, clock } = makeEnv();
    let n = 0;
    registerPane('home', () => (n += 1), env);
    clock.t += COALESCE_MS;
    d.visibilityState = 'hidden';
    d.fire('visibilitychange');
    expect(n).toBe(0);
  });

  it('pageshow (bfcache restore), focus and __renaShow all activate', () => {
    const { env, w, clock } = makeEnv();
    let n = 0;
    registerPane('account', () => (n += 1), env);
    clock.t += COALESCE_MS;
    w.fire('pageshow', { persisted: true });
    expect(n).toBe(1);
    clock.t += COALESCE_MS;
    w.fire('focus');
    expect(n).toBe(2);
    clock.t += COALESCE_MS;
    (w.__renaShow as () => void)();
    expect(n).toBe(3);
  });

  it('explicit invalidation bypasses coalescing, on the storage event, even while hidden', () => {
    const { env, w, d, clock } = makeEnv();
    let n = 0;
    registerPane('home', () => (n += 1), env);
    clock.t += 1000; // well inside the window
    d.visibilityState = 'hidden';
    w.fire('storage', { key: staleKey('home'), newValue: String(clock.t) });
    expect(n).toBe(1);
    // another pane's key is not ours
    w.fire('storage', { key: staleKey('mycleans'), newValue: String(clock.t) });
    // a removal (newValue null) is not an invalidation
    w.fire('storage', { key: staleKey('home'), newValue: null });
    expect(n).toBe(1);
  });

  it('a marker written while the pane was unloaded lands on the next activation inside the window', () => {
    const { env, storage, d, clock } = makeEnv();
    let n = 0;
    registerPane('mycleans', () => (n += 1), env);
    clock.t += 2000;
    storage.setItem(staleKey('mycleans'), String(clock.t)); // same document, no storage event
    d.fire('visibilitychange');
    expect(n).toBe(1);
    expect(storage.getItem(staleKey('mycleans'))).toBeNull();
  });

  it('consumes a marker at registration (the mount load is the fresh fetch)', () => {
    const { env, storage, clock } = makeEnv();
    storage.setItem(staleKey('home'), String(clock.t));
    registerPane('home', () => undefined, env);
    expect(storage.getItem(staleKey('home'))).toBeNull();
  });

  it('ignores and removes a marker older than 60 minutes', () => {
    const { env, storage, d, clock } = makeEnv();
    let n = 0;
    registerPane('home', () => (n += 1), env);
    storage.setItem(staleKey('home'), String(clock.t - STALE_MAX_AGE_MS - 1));
    clock.t += 1000;
    d.fire('visibilitychange');
    expect(n).toBe(0);
    expect(storage.getItem(staleKey('home'))).toBeNull();
  });

  it('__renaRefresh is always fresh, ignoring the window', () => {
    const { env, w } = makeEnv();
    let n = 0;
    registerPane('home', () => (n += 1), env);
    (w.__renaRefresh as () => void)();
    (w.__renaRefresh as () => void)();
    expect(n).toBe(2);
  });

  it('markStale writes one timestamp key per pane and carries no data', () => {
    const { env, storage, clock } = makeEnv();
    markStale(['home', 'mycleans'], env);
    expect(Array.from(storage.map.entries())).toEqual([
      [staleKey('home'), String(clock.t)],
      [staleKey('mycleans'), String(clock.t)],
    ]);
  });

  it('clearAllStale removes only the freshness keys (sign out)', () => {
    const { env, storage } = makeEnv();
    storage.setItem('rena-consent', 'all');
    markStale(['home', 'account'], env);
    clearAllStale(env);
    expect(Array.from(storage.map.keys())).toEqual(['rena-consent']);
  });

  it('survives a throwing or missing storage', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
      length: 0,
      key: () => null,
    };
    const a = makeEnv(throwing as unknown as ReturnType<typeof memoryStorage>);
    expect(() => markStale(['home'], a.env)).not.toThrow();
    expect(() => registerPane('home', () => undefined, a.env)).not.toThrow();
    const b = makeEnv();
    b.env.storage = null;
    expect(() => markStale(['home'], b.env)).not.toThrow();
  });

  it('unregister removes every listener and only its own globals', () => {
    const { env, w, d } = makeEnv();
    const off = registerPane('home', () => undefined, env);
    expect(d.count('visibilitychange')).toBe(1);
    off();
    expect(d.count('visibilitychange')).toBe(0);
    expect(w.count('pageshow') + w.count('focus') + w.count('storage')).toBe(0);
    expect(w.__renaRefresh).toBeUndefined();
    const offA = registerPane('home', () => undefined, env);
    const offB = registerPane('mycleans', () => undefined, env);
    offA(); // B registered later and still owns the globals
    expect(typeof w.__renaRefresh).toBe('function');
    offB();
  });
});
