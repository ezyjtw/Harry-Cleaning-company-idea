'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import ChromeHider from '@/components/ChromeHider';
import NavLink from '@/components/nav/NavLink';

// F11: grouped nav — the four previously-unreachable pages (verification,
// Rena-Find queue, release funds, pricing) join the sidebar. Badge keys pull
// live pending counts (60s poll, countOnly pattern like the notification bell).
type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: 'verification' | 'renaFind' | 'reviews';
};
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/admin/bookings',
        label: 'Bookings',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        href: '/admin/bookings/rena-find-queue',
        label: 'Rena-Find Queue',
        icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
        badge: 'renaFind',
      },
      {
        href: '/admin/release-funds',
        label: 'Release Funds',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        href: '/admin/bookings/stuck-money',
        label: 'Stuck Money',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      },
      {
        href: '/admin/disputes',
        label: 'Disputes',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      },
      {
        href: '/admin/message-reports',
        label: 'Message Reports',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        href: '/admin/customers',
        label: 'Customers',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        href: '/admin/waitlist',
        label: 'Waitlist',
        icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      },
      {
        href: '/admin/cleaners',
        label: 'Cleaners',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      },
      {
        href: '/admin/verification',
        label: 'Verification',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        badge: 'verification',
      },
      {
        href: '/admin/imported-reviews',
        label: 'Reviews',
        badge: 'reviews',
        icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      },
    ],
  },
  {
    label: 'Config',
    items: [
      {
        href: '/admin/pricing',
        label: 'Pricing',
        icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
      },
      {
        href: '/admin/compliance',
        label: 'Compliance',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      },
      {
        href: '/admin/xero',
        label: 'Xero',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z',
      },
    ],
  },
];

export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // F11: live pending counts for the badge-carrying items.
  const [counts, setCounts] = useState<{ verification: number; renaFind: number; reviews: number }>(
    { verification: 0, renaFind: 0, reviews: 0 }
  );
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/nav-counts');
        if (res.ok) {
          const d = await res.json();
          setCounts({
            verification: d.verificationPending ?? 0,
            renaFind: d.renaFindQueue ?? 0,
            reviews: d.reviewCleaners ?? 0,
          });
        }
      } catch {
        /* badge poll is best-effort */
      }
    };
    poll();
    const t = setInterval(poll, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-page">
      {/* Suppress the global Navbar/Footer — admin brings its own shell (was
          double-chrome: the marketing nav/footer rendered on top of this). */}
      <ChromeHider bodyClass="admin-active" />
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-ink px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white/70 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Admin Panel</span>
          <span className="inline-flex items-center rounded-full bg-danger/25 px-2.5 py-0.5 text-xs font-medium text-white">
            Admin
          </span>
        </div>
        <div className="w-6" />
      </div>

      <div className="flex">
        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-ink/50 z-40 lg:hidden"
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
          {/* Admin header */}
          <div className="shrink-0 p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <div>
                <p className="font-semibold text-white">Admin Panel</p>
                <span className="inline-flex items-center rounded-full bg-danger/25 px-2 py-0.5 text-xs font-medium text-white">
                  Super Admin
                </span>
              </div>
            </div>
          </div>

          {/* Navigation. H70: the aside is now a flex column and this list is
              the shrinkable, SCROLLING region (min-h-0 is what lets a flex
              child actually scroll) — previously overflow-y-auto sat on an
              unbounded block, so short viewports cut off the lower sections
              with no way to reach them. */}
          <nav className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label ?? 'root'}>
                {group.label && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const badgeCount =
                      item.badge === 'verification'
                        ? counts.verification
                        : item.badge === 'renaFind'
                          ? counts.renaFind
                          : item.badge === 'reviews'
                            ? counts.reviews
                            : 0;
                    return (
                      <NavLink
                        surface="admin-sidebar"
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${
                            isActive
                              ? 'bg-white/10 text-white'
                              : 'text-white/60 hover:bg-white/10 hover:text-white'
                          }
                        `}
                      >
                        <svg
                          className="w-5 h-5 flex-shrink-0"
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
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom — a normal flex footer (was absolutely positioned OVER the
              nav, hiding whatever scrolled beneath it). */}
          <div className="shrink-0 p-4 border-t border-white/10">
            <NavLink
              surface="admin-sidebar"
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Back to Site
            </NavLink>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
