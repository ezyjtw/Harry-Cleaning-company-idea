'use client';

import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

import ChromeHider from '@/components/ChromeHider';
import NotificationBell from '@/components/layout/NotificationBell';
import NavLink from '@/components/nav/NavLink';

const navItems = [
  {
    href: '/cleaner',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  },
  {
    href: '/cleaner/profile',
    label: 'Profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    href: '/cleaner/pricing',
    label: 'Pricing',
    icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  },
  {
    href: '/cleaner/jobs',
    label: 'My Jobs',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    href: '/cleaner/notifications',
    label: 'Notifications',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
  {
    href: '/cleaner/availability',
    label: 'Availability',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/cleaner/calendar',
    label: 'Calendar',
    icon: 'M8 7V3m8 4V3m-9 8h2m4 0h2m-8 4h2m4 0h2M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/cleaner/earnings',
    label: 'Earnings & Statements',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/cleaner/reviews',
    label: 'Reviews',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  },
  {
    href: '/disputes',
    label: 'Disputes',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  {
    href: '/cleaner/imported-reviews',
    label: 'Imported Reviews',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  },
  {
    href: '/cleaner/preview',
    label: 'Profile Preview',
    icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  },
  // H38: the customer-role shelf — cleans this cleaner BOOKED as a customer.
  // Last in the list, apart from the work items above.
  {
    href: '/cleaner/my-bookings',
    label: 'My Bookings',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  },
];

// The former sidebar completion-% widget was retired in favour of the dashboard
// CleanerSetupChecklist (single source of truth for "profile complete").
export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // H10→F10 (James-ruled): the Jobs badge is the OPEN-OFFER COUNT — every
  // offer is time-boxed, so red urgency holds until each one is answered.
  // Viewing the page no longer clears it (the old seen-tracking); it clears
  // the moment no offers await. Matches the native tab bar's A7 semantics.
  // Best-effort — any error just means no badge.
  const [unseenOffers, setUnseenOffers] = useState(0);
  // H43→F10 (James-ruled): the Disputes badge is the OPEN-DISPUTE COUNT —
  // disputes carry response deadlines and evidence windows; "I looked at it
  // once" is not "I dealt with it." Clears only on resolution, never on viewing.
  const [unseenDisputes, setUnseenDisputes] = useState(0);
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch('/api/cleaner/badges');
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (stop || !data) return;
        if (Array.isArray(data.offerIds)) {
          // F27: arrangement requests respond from the Jobs page — same
          // time-boxed urgency as offers, same badge.
          const arrangements = Array.isArray(data.arrangementIds) ? data.arrangementIds.length : 0;
          setUnseenOffers(data.offerIds.length + arrangements);
        }
        if (Array.isArray(data.disputeIds)) {
          setUnseenDisputes(data.disputeIds.length);
        }
      } catch {
        /* badge is best-effort */
      }
    }
    tick();
    const iv = setInterval(tick, 60_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [pathname]);
  const [cleanerName, setCleanerName] = useState('');
  const [cleanerTier, setCleanerTier] = useState('');
  const [cleanerImage, setCleanerImage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [initials, setInitials] = useState('');

  // Rena Pro shell-skin (item 6): when the portal is viewed INSIDE the native
  // shell, tag <body> so globals.css renders this page app-fit. GATED on the
  // RenaPro/ UA suffix (set by the shell's WebView, persists across in-app
  // navigation) — a normal browser NEVER matches, so the web portal is byte-
  // identical. Nothing here runs unless the UA test passes.
  const [shellSeg, setShellSeg] = useState<string | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !/RenaPro\//i.test(navigator.userAgent)) return;
    const parts = pathname.split('/').filter(Boolean);
    const ci = parts.indexOf('cleaner');
    setShellSeg(ci >= 0 ? parts[ci + 1] || 'root' : 'root');
  }, [pathname]);
  useEffect(() => {
    if (!shellSeg) return;
    const classes = ['rena-shell', `rena-page-${shellSeg}`];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [shellSeg]);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          // R3: a 401 here means the server rejected a session the JWT still
          // considers valid — pushing to /login just bounced back (middleware
          // sees the live cookie and redirects to /dashboard: infinite loop).
          // signOut destroys the stale cookie first, so /login actually renders.
          signOut({ callbackUrl: '/login' });
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data) return;
        if (!data.onboardingComplete && !pathname.startsWith('/cleaner/complete-profile')) {
          router.push('/cleaner/complete-profile');
          return;
        }
        setCleanerName(data.name || 'Cleaner');
        setCleanerTier(data.tier || 'STARTER');
        setCleanerImage(data.image || '');
        const parts = (data.name || '').split(' ');
        setInitials(
          parts
            .map((p: string) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        );
      })
      .catch(() => {});
  }, [router, pathname]);

  return (
    <div className="min-h-screen bg-page">
      {/* Suppress the global Navbar/Footer — the portal brings its own chrome. */}
      <ChromeHider bodyClass="portal-active" />
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-ink px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white/80 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        {/* H26: the mobile wordmark was inert text — now it's the way home. */}
        <NavLink
          surface="cleaner-mobile-header"
          href="/cleaner"
          className="flex items-center gap-2"
        >
          <span className="font-etna text-lg tracking-widest text-white">RENA</span>
          <span className="font-jost text-[10px] uppercase tracking-[0.15em] text-white/45">
            Cleaner
          </span>
        </NavLink>
        {/* F10: portal bell — offers surface mid-session (60s badge poll). */}
        <NotificationBell role="CLEANER" tone="dark" />
      </div>

      <div className="flex">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-ink/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-0 left-0 z-50 lg:z-0
            w-64 h-screen bg-ink
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            flex flex-col
          `}
        >
          {/* Brand. H26: the wordmark goes HOME (the dashboard) — inside the
              portal, "/" is an exit to the marketing site, and that exit
              already exists explicitly as "Back to Site" at the bottom. */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <NavLink
              surface="cleaner-sidebar-brand"
              href="/cleaner"
              className="flex items-center gap-2"
            >
              <span className="font-etna text-xl font-semibold tracking-widest text-white">
                RENA
              </span>
              <span className="font-jost text-[9px] uppercase tracking-[0.2em] text-white/45">
                Cleaner Portal
              </span>
            </NavLink>
            {/* F10: portal bell (desktop) — prominent, dark tone. */}
            <div className="hidden lg:block">
              <NotificationBell role="CLEANER" tone="dark" />
            </div>
          </div>

          {/* Cleaner info */}
          <div className="px-6 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {cleanerImage && !imageFailed ? (
                  /* F4: plain <img>, NOT next/image. The avatar is a 24h presigned
                     R2 URL — its host isn't (and shouldn't be) in next.config
                     images, so next/image throws/400s and the fallback initials
                     shown forever. Same pattern as CleanerAvatar everywhere else. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cleanerImage}
                    alt=""
                    width={40}
                    height={40}
                    onError={() => setImageFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-jost font-medium text-sm">
                    {initials || '..'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-jost font-light text-white/90 text-sm truncate uppercase">
                  {cleanerName || 'Loading...'}
                </p>
                <span className="font-jost text-[10px] uppercase tracking-[0.12em] text-white/45">
                  {cleanerTier
                    ? `${cleanerTier.charAt(0) + cleanerTier.slice(1).toLowerCase()} Tier`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          {/* H70 sweep: min-h-0 so the flex child genuinely scrolls at short
              viewport heights instead of pushing the sign-out block off. */}
          <nav className="flex-1 min-h-0 p-3 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const showJobsBadge = item.href === '/cleaner/jobs' && unseenOffers > 0;
              const showDisputeBadge = item.href === '/disputes' && unseenDisputes > 0;
              return (
                <NavLink
                  surface="cleaner-sidebar"
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-jost font-light transition-all duration-150
                    ${
                      isActive
                        ? 'bg-white/[0.14] text-white'
                        : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                    }
                  `}
                >
                  <svg
                    className="w-[18px] h-[18px] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={item.icon}
                    />
                  </svg>
                  {item.label}
                  {/* H10: live-offer attention badge — the bell's countOnly
                      grammar on the Jobs item. */}
                  {showJobsBadge && (
                    <span
                      data-testid="jobs-offer-badge"
                      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-jost text-[11px] font-semibold text-white"
                    >
                      {unseenOffers > 9 ? '9+' : unseenOffers}
                    </span>
                  )}
                  {/* H43: open-dispute attention badge on the Disputes item. */}
                  {showDisputeBadge && (
                    <span
                      data-testid="disputes-badge"
                      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-jost text-[11px] font-semibold text-white"
                    >
                      {unseenDisputes > 9 ? '9+' : unseenDisputes}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <NavLink
              surface="cleaner-sidebar"
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-jost font-light text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-150"
            >
              <svg
                className="w-[18px] h-[18px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Back to Site
            </NavLink>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-jost font-light text-white/40 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
            >
              <svg
                className="w-[18px] h-[18px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
