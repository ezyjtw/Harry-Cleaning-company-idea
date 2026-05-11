'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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
    href: '/cleaner/availability',
    label: 'Availability',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/cleaner/earnings',
    label: 'Earnings',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/cleaner/reviews',
    label: 'Reviews',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  },
];

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cleanerName, setCleanerName] = useState('');
  const [cleanerTier, setCleanerTier] = useState('');
  const [initials, setInitials] = useState('');

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
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
    <div className="min-h-screen bg-cream">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-ink px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-cream/80 hover:text-cream"
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
        <div className="flex items-center gap-2">
          <span className="font-cormorant text-lg font-light text-cream">Cleaner Portal</span>
        </div>
        <div className="w-6" />
      </div>

      <div className="flex">
        {/* Sidebar overlay for mobile */}
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
          `}
        >
          {/* Cleaner info header */}
          <div className="p-6" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-cormorant font-light">
                {initials || '..'}
              </div>
              <div>
                <p className="font-jost font-light text-cream text-sm">
                  {cleanerName || 'Loading...'}
                </p>
                <span className="font-jost text-[10px] uppercase tracking-[0.1em] text-gold">
                  {cleanerTier
                    ? `${cleanerTier.charAt(0) + cleanerTier.slice(1).toLowerCase()} Tier`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-sm font-jost font-light transition-colors
                    ${
                      isActive
                        ? 'bg-cream/10 text-cream'
                        : 'text-cream/60 hover:bg-cream/5 hover:text-cream/80'
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
                  {item.label}
                  {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div
            className="absolute bottom-0 left-0 right-0 p-4"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-jost font-light text-cream/40 hover:text-cream/60 transition-colors"
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
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
