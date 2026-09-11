'use client';

// Customer app L2 shared pieces (Phase 2, James-ruled). The design law
// carries from Pro: Jost everywhere, navy #16296b accents, compact am/pm
// voice, flat cards with hairline borders, no bare dashes, no zeros.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

// ─── Compact voice helpers (the Pro grammar) ─────────────────────────────────

/** '09:00' → '9am' · '13:30' → '1:30pm' — the compact am/pm voice. */
export function fmtSlotTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return t || '';
  let h = Number(m[1]);
  const min = m[2];
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return min === '00' ? `${h}${ap}` : `${h}:${min}${ap}`;
}

/** Booking day word: Today / Tomorrow / 'Sat 14 Sep'. */
export function dayPhrase(dateIso: string): string {
  const d = new Date(`${dateIso.split('T')[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Past-tense day word for the review card: Today's / Yesterday's / Saturday's. */
export function pastDayWord(dateIso: string): string {
  const d = new Date(`${dateIso.split('T')[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today's";
  if (diff === 1) return "Yesterday's";
  if (diff < 7) return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}'s`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}'s`;
}

/** £84 · £84.50 — never £84.00 (no zeros law). */
export function fmtPounds(n: number): string {
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2).replace(/\.00$/, '')}`;
}

export function greetingWord(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export function dateEyebrow(): string {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Avatar: real photo fills the circle, coloured initials as fallback ──────
export function CustomerAvatar({
  photo,
  name,
  size = 36,
}: {
  photo: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft ring-1 ring-line"
      style={{ width: size, height: size }}
    >
      {photo && !failed ? (
        /* Presigned R2 URL — plain <img>, the F4 pattern (next/image 400s on R2). */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-jost font-medium text-primary"
          style={{ fontSize: Math.round(size * 0.38) }}
        >
          {initialsOf(name) || '·'}
        </span>
      )}
    </div>
  );
}

// ─── The shared empty hero: Home's empty state and My Cleans' empty Upcoming ─
// (James-ruled: one component, built once.)
export function NoCleansCard() {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-10 text-center">
      <p className="font-jost text-[19px] font-semibold text-ink">No Cleans Booked</p>
      <p className="mx-auto mt-1.5 max-w-[240px] font-jost text-[13px] leading-snug text-ink-3">
        Book a vetted local cleaner and your cleans will live here.
      </p>
      <Link
        href="/app/book"
        className="mt-5 inline-flex rounded-[10px] bg-primary px-7 py-3 font-jost text-[12px] font-semibold uppercase tracking-[0.12em] text-white active:opacity-90"
      >
        Book A Clean
      </Link>
    </div>
  );
}

// ─── Bell: quiet door to notifications (no customer badge endpoint yet) ──────
export function CustomerBell() {
  return (
    <Link
      href="/account/notifications"
      aria-label="Notifications"
      className="shrink-0 rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    </Link>
  );
}

// ─── Account menu: Pro's shape B, customer clothes ───────────────────────────
// Person button → sheet with profile header and account doors; Sign Out keeps
// the confirm beat. NextAuth → /en/login, which the customer shell's
// onSessionLost path sees and clears the native bearer.
export function CustomerAccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'menu' | 'signout'>('menu');
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  const openMenu = () => {
    setStage('menu');
    setOpen(true);
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const u = data?.id ? data : data?.user;
        if (u?.name || u?.email) setProfile({ name: u.name || 'You', email: u.email || '' });
      })
      .catch(() => {});
  };

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut({ callbackUrl: '/en/login' });
  };

  const rowCls =
    'flex w-full items-center justify-between py-3.5 text-left font-jost text-[15px] font-medium text-ink active:opacity-70';
  const chevron = (
    <svg
      className="h-4 w-4 text-ink-3"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Account"
        onClick={openMenu}
        className="shrink-0 rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-ink/40"
          role="dialog"
          aria-modal="true"
          aria-label="Account"
          onClick={() => !signingOut && setOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-lg rounded-t-2xl border-t border-line bg-surface px-5 pt-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {stage === 'menu' ? (
              <>
                <div className="flex items-center gap-3.5 border-b border-line pb-4">
                  <CustomerAvatar photo={null} name={profile?.name || ''} size={48} />
                  <div className="min-w-0">
                    <p className="truncate font-jost text-[17px] font-semibold text-ink">
                      {profile?.name || ' '}
                    </p>
                    {profile?.email && (
                      <p className="truncate font-jost text-[12px] text-ink-3">{profile.email}</p>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-line/60">
                  <button type="button" className={rowCls} onClick={() => go('/account/settings')}>
                    Account Settings
                    {chevron}
                  </button>
                  <button
                    type="button"
                    className={rowCls}
                    onClick={() => go('/account/notifications')}
                  >
                    Notifications
                    {chevron}
                  </button>
                  <button type="button" className={rowCls} onClick={() => go('/contact')}>
                    Contact Rena
                    {chevron}
                  </button>
                  <button
                    type="button"
                    className={`${rowCls} text-danger`}
                    data-testid="menu-sign-out"
                    onClick={() => setStage('signout')}
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-jost text-xl font-semibold text-ink">Sign out of Rena?</h2>
                <p className="mt-1.5 font-jost text-sm text-ink-2">
                  You&apos;ll need your password to get back in.
                </p>
                <button
                  type="button"
                  onClick={doSignOut}
                  disabled={signingOut}
                  className="mt-5 w-full rounded-[10px] bg-primary py-3 font-jost text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
                <button
                  type="button"
                  onClick={() => setStage('menu')}
                  disabled={signingOut}
                  className="mt-1 w-full py-3 font-jost text-sm font-medium text-ink-2 active:opacity-70 disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
