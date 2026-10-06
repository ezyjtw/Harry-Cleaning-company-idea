// RENA-018 / RENA-025 (B2a, D-o as amended by James 2026-10-07): the
// customer freshness contract.
//
// A page registers itself as a named pane. It then refetches:
//   - always, when the shell's pull to refresh calls window.__renaRefresh;
//   - immediately, ignoring any throttle, when another page or another
//     WebView pane marks it stale (explicit invalidation): a per pane
//     localStorage key, rena:stale:<pane>, delivered by the storage event to
//     every other document of the origin and checked again on activation;
//   - on activation (visibilitychange to visible, pageshow, focus, and
//     window.__renaShow for the shell), coalesced: at most once per 15 s.
//
// localStorage, not sessionStorage: sessionStorage is per tab and per WebView
// pane, so a marker written by the confirmation page or by My Cleans would
// never reach Home. The keys carry a timestamp only, never an id or any
// personal data, and a marker older than 60 minutes is ignored.
//
// Everything browser shaped is injected through `env`, so the contract is
// unit tested in node without a DOM.

export type PaneName = 'home' | 'mycleans' | 'account' | 'cleaner';

export const COALESCE_MS = 15_000;
export const STALE_MAX_AGE_MS = 60 * 60 * 1000;
const PREFIX = 'rena:stale:';

export const staleKey = (pane: PaneName): string => `${PREFIX}${pane}`;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

interface EventTargetLike {
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
}

export interface FreshnessEnv {
  window: EventTargetLike & Record<string, unknown>;
  document: EventTargetLike & { visibilityState: string };
  storage: StorageLike | null;
  now: () => number;
}

function browserEnv(): FreshnessEnv | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  let storage: StorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    window: window as unknown as FreshnessEnv['window'],
    document,
    storage,
    now: () => Date.now(),
  };
}

function readMarker(env: FreshnessEnv, pane: PaneName): number | null {
  try {
    const raw = env.storage?.getItem(staleKey(pane));
    if (!raw) return null;
    const at = Number(raw);
    if (!Number.isFinite(at)) return null;
    return at;
  } catch {
    return null;
  }
}

function clearMarker(env: FreshnessEnv, pane: PaneName): void {
  try {
    env.storage?.removeItem(staleKey(pane));
  } catch {
    // storage unavailable (private mode, quota): nothing to clear
  }
}

/** True when a fresh (under an hour old) marker names this pane. */
function isMarkedStale(env: FreshnessEnv, pane: PaneName): boolean {
  const at = readMarker(env, pane);
  if (at === null) return false;
  if (env.now() - at > STALE_MAX_AGE_MS) {
    clearMarker(env, pane);
    return false;
  }
  return true;
}

/**
 * Explicit invalidation: a confirmed booking affecting mutation (payment
 * success, cancellation, reschedule accept, recurring setup, top up) marks
 * the panes that show it. Never throws.
 */
export function markStale(panes: PaneName[], env: FreshnessEnv | null = browserEnv()): void {
  if (!env?.storage) return;
  const at = String(env.now());
  for (const pane of panes) {
    try {
      env.storage.setItem(staleKey(pane), at);
    } catch {
      // storage unavailable: the pane still refreshes on activation
    }
  }
}

/** Sign out: no marker outlives an account on a shared device. */
export function clearAllStale(env: FreshnessEnv | null = browserEnv()): void {
  if (!env?.storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < env.storage.length; i += 1) {
      const k = env.storage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) env.storage.removeItem(k);
  } catch {
    // storage unavailable
  }
}

/**
 * Register a pane. `refetch` reloads the pane's data without a skeleton
 * (stale while revalidate). The caller performs its own first load at mount;
 * registration counts that as the latest fetch and consumes any marker.
 * Returns the unregister function for the effect cleanup.
 */
export function registerPane(
  pane: PaneName,
  refetch: () => void,
  env: FreshnessEnv | null = browserEnv()
): () => void {
  if (!env) return () => undefined;
  const w = env.window;
  const d = env.document;
  let lastFetch = env.now();
  clearMarker(env, pane);

  const run = () => {
    lastFetch = env.now();
    clearMarker(env, pane);
    refetch();
  };

  const activate = () => {
    if (isMarkedStale(env, pane)) {
      run(); // explicit invalidation overrides coalescing
      return;
    }
    if (env.now() - lastFetch >= COALESCE_MS) run();
  };

  const onVisibility = () => {
    if (d.visibilityState === 'visible') activate();
  };
  const onStorage = (e: unknown) => {
    const ev = e as { key?: string | null; newValue?: string | null };
    if (ev.key === staleKey(pane) && ev.newValue) run();
  };

  const refresh = () => run();
  const show = () => activate();

  d.addEventListener('visibilitychange', onVisibility);
  w.addEventListener('pageshow', activate);
  w.addEventListener('focus', activate);
  w.addEventListener('storage', onStorage);
  w.__renaRefresh = refresh;
  w.__renaShow = show;

  return () => {
    d.removeEventListener('visibilitychange', onVisibility);
    w.removeEventListener('pageshow', activate);
    w.removeEventListener('focus', activate);
    w.removeEventListener('storage', onStorage);
    if (w.__renaRefresh === refresh) delete w.__renaRefresh;
    if (w.__renaShow === show) delete w.__renaShow;
  };
}
