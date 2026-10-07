// RENA-019 (B2b, James-ruled amendment 1): one honest classification of a
// pane's data fetch, so an API failure is never shown as an empty state.
//
//   network failure (fetch throws, or the browser says offline) → 'offline'
//   401                                                          → 'unauthorised' (the only session-loss answer)
//   403                                                          → 'forbidden' (access or account state; never touches the session)
//   429, 5xx and any other non-2xx                                → 'error' (retryable)
//   2xx                                                          → ok, and only a successful empty body renders empty
//
// Dependencies are injected so the contract is unit tested in node.

export type LoadFailure = 'offline' | 'unauthorised' | 'forbidden' | 'error';

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: LoadFailure; status: number | null };

export interface LoadDeps {
  fetch: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  online: () => boolean;
}

export function classifyStatus(status: number): LoadFailure {
  if (status === 401) return 'unauthorised';
  if (status === 403) return 'forbidden';
  return 'error';
}

function browserDeps(): LoadDeps {
  return {
    fetch: (url) => fetch(url),
    online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  };
}

export async function loadJson<T>(
  url: string,
  deps: LoadDeps = browserDeps()
): Promise<LoadResult<T>> {
  if (!deps.online()) return { ok: false, failure: 'offline', status: null };
  let res: Awaited<ReturnType<LoadDeps['fetch']>>;
  try {
    res = await deps.fetch(url);
  } catch {
    return { ok: false, failure: 'offline', status: null };
  }
  if (!res.ok) return { ok: false, failure: classifyStatus(res.status), status: res.status };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    // A 2xx whose body is not JSON is a broken answer, not an empty one.
    return { ok: false, failure: 'error', status: res.status };
  }
}

/**
 * The R6 belt for a definitive 401: clear the stale cookie first (a plain
 * route to /login is bounced back by the middleware while it exists), then
 * land on the login form with a way back. Inside the customer shell the
 * watcher turns this /login landing into the native sign-out.
 */
export async function endSessionToLogin(
  callbackUrl: string,
  signOut: (opts: { redirect: false }) => Promise<unknown>
): Promise<void> {
  await signOut({ redirect: false }).catch(() => {});
  window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
