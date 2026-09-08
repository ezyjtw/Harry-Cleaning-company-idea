'use client';

// Shape B (James-ruled, P3): the quiet account affordance beside the bell on
// every L2 header. Person button → sheet with a profile header (photo, name,
// F26 visibility status line) and rows: My Profile · Contact Rena · Sign Out.
// Sign-out keeps the existing confirm beat: NextAuth → /en/login, which the
// shell's onSessionLost path sees and clears the native Keychain bearer.
// Switch-account is deliberately not built — the native login screen is the
// switch, and the Face ID lock already offers "Switch account".

import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

import { haptic } from '@/components/app/job-cards';

interface MenuProfile {
  name: string;
  image: string | null;
  visibleInDirectory: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AccountMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'menu' | 'signout'>('menu');
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<MenuProfile | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const openMenu = () => {
    haptic('light');
    setStage('menu');
    setOpen(true);
    // Lazy, best-effort — the sheet renders immediately and fills in.
    fetch('/api/cleaner/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            name: data.name || 'Cleaner',
            image: data.image || null,
            visibleInDirectory: data.visibleInDirectory !== false,
          });
        }
      })
      .catch(() => {});
  };

  const go = (path: string) => {
    haptic('light');
    setOpen(false);
    router.push(path);
  };

  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    haptic('medium');
    // The shell's onNav watches for /login and fires onSessionLost, which clears
    // the native bearer and returns to the native login screen. On web preview
    // this simply lands on the login page.
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
        className={`shrink-0 rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page ${className || ''}`}
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
                {/* Profile header */}
                <div className="flex items-center gap-3.5 border-b border-line pb-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-page ring-1 ring-line">
                    {profile?.image && !imageFailed ? (
                      /* Presigned R2 URL — plain <img>, same F4 pattern as the
                         portal sidebar (next/image would 400 on the R2 host). */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.image}
                        alt=""
                        width={48}
                        height={48}
                        onError={() => setImageFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-jost text-sm font-medium text-ink-2">
                        {profile ? initialsOf(profile.name) : '··'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-jost text-[17px] font-semibold text-ink">
                      {profile?.name || ' '}
                    </p>
                    {/* F26 visibility status line */}
                    {profile && (
                      <p
                        className={`font-jost text-[12px] ${
                          profile.visibleInDirectory ? 'text-ink-3' : 'font-medium text-danger'
                        }`}
                        data-testid="menu-visibility-line"
                      >
                        {profile.visibleInDirectory ? 'Profile visible' : 'Profile hidden'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-line/60">
                  <button type="button" className={rowCls} onClick={() => go('/app/profile')}>
                    My Profile
                    {chevron}
                  </button>
                  <button type="button" className={rowCls} onClick={() => go('/app/contact')}>
                    Contact Rena
                    {chevron}
                  </button>
                  <button
                    type="button"
                    className={`${rowCls} text-danger`}
                    data-testid="menu-sign-out"
                    onClick={() => {
                      haptic('light');
                      setStage('signout');
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-jost text-xl font-semibold text-ink">Sign out of Rena Pro?</h2>
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
