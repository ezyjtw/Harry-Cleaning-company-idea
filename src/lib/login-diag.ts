// ─── TEMPORARY LOGIN DIAGNOSTICS (James-ordered, 2026-10-05) ────────────────
// Home-after-login investigation: every request in the login window logs the
// session it carried and the status it got, readable in Railway logs. This
// module, the /api/shell/diag beacon route, and every `loginDiag(` call site
// are REMOVED in the fix commit. Nothing here changes behaviour.

export const LOGIN_DIAG_TAG = '[login-diag]';

// The Home-window surface: both landings' documents, the APIs those pages fire
// at mount, the bridge, and the Pro badges poll.
export const LOGIN_DIAG_PATHS =
  /^\/(en\/)?(app\/(home|today)|api\/(auth\/(profile|session-bridge)|bookings|cleaner\/(jobs|badges)))(\/|\?|$)/;

export function loginDiag(scope: string, fields: Record<string, unknown>): void {
  try {
    // eslint-disable-next-line no-console
    console.log(`${LOGIN_DIAG_TAG} ${scope} ${JSON.stringify(fields)}`);
  } catch {
    /* diagnostics never throw */
  }
}
