// ─── Rena Pro app-shell detection ────────────────────────────────────────────
//
// The native shell identifies itself two ways (belt-and-suspenders — custom
// headers can be stripped on some sub-requests, the UA suffix survives more
// reliably):
//   • request header  `x-rena-shell: pro-ios/<build>`  (or pro-android/…)
//   • User-Agent suffix `… RenaPro/<version>`
//
// The web uses this to: hide marketing chrome inside the app (the native tab bar
// replaces it) and serve /app/* only to the shell.

export const SHELL_HEADER = 'x-rena-shell';

/** True if the request originates from the Rena Pro native shell. */
export function isRenaShell(headers: { get(name: string): string | null }): boolean {
  const shellHeader = headers.get(SHELL_HEADER);
  if (shellHeader && shellHeader.trim().length > 0) return true;

  const ua = headers.get('user-agent') || '';
  return /\bRenaPro\//i.test(ua);
}

/**
 * Client-side shell detection for 'use client' components (the shell appends
 * `RenaPro/<version>` to the WebView User-Agent). Always false during SSR, so
 * server-rendered HTML is byte-identical for browser visitors — components
 * using this self-suppress only inside the shell, at hydration.
 */
export function isShellUA(): boolean {
  return typeof navigator !== 'undefined' && /\bRenaPro\//i.test(navigator.userAgent);
}
