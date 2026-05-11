'use client';

import Image from 'next/image';
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

interface ProfileData {
  name?: string;
  tier?: string;
  image?: string;
  bio?: string;
  postcode?: string;
  specialties?: string[];
  languages?: string[];
  serviceTypes?: string[];
  serviceRates?: Record<string, string>;
  hourlyRate?: number;
  hoursPerWeek?: number;
  onboardingComplete?: boolean;
}

function getCompletionSections(data: ProfileData | null) {
  if (!data) return { sections: [], percent: 0 };
  const sections = [
    { label: 'Photo', done: !!data.image },
    { label: 'Bio', done: !!(data.bio && data.bio.trim()) },
    { label: 'Postcode', done: !!(data.postcode && data.postcode.trim()) },
    { label: 'Specialties', done: !!(data.specialties && data.specialties.length > 0) },
    { label: 'Languages', done: !!(data.languages && data.languages.length > 0) },
    { label: 'Services', done: !!(data.serviceTypes && data.serviceTypes.length > 0) },
    { label: 'Pricing', done: !!(data.hourlyRate && data.hourlyRate > 0) },
  ];
  const doneCount = sections.filter((s) => s.done).length;
  return { sections, percent: Math.round((doneCount / sections.length) * 100) };
}

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cleanerName, setCleanerName] = useState('');
  const [cleanerTier, setCleanerTier] = useState('');
  const [cleanerImage, setCleanerImage] = useState('');
  const [initials, setInitials] = useState('');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

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
        setCleanerImage(data.image || '');
        setProfileData(data);
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

  const { sections, percent } = getCompletionSections(profileData);
  const allComplete = percent === 100;

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
          <span className="font-cormorant text-lg font-light text-cream">Rena</span>
          <span className="font-jost text-[10px] uppercase tracking-[0.15em] text-cream/50">
            Cleaner
          </span>
        </div>
        <div className="w-6" />
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
          {/* Brand */}
          <div className="px-6 pt-6 pb-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-cormorant text-xl font-light text-cream">Rena</span>
              <span className="font-jost text-[9px] uppercase tracking-[0.2em] text-cream/70">
                Cleaner Portal
              </span>
            </Link>
          </div>

          {/* Cleaner info */}
          <div className="px-6 py-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                {cleanerImage ? (
                  <Image
                    src={cleanerImage}
                    alt=""
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gold font-cormorant font-light text-sm">
                    {initials || '..'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-jost font-light text-cream text-sm truncate">
                  {cleanerName || 'Loading...'}
                </p>
                <span className="font-jost text-[10px] uppercase tracking-[0.12em] text-cream/60">
                  {cleanerTier
                    ? `${cleanerTier.charAt(0) + cleanerTier.slice(1).toLowerCase()} Tier`
                    : ''}
                </span>
              </div>
            </div>

            {/* Profile completion */}
            {profileData && !allComplete && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-jost text-[10px] uppercase tracking-[0.1em] text-cream/40">
                    Profile
                  </span>
                  <span className="font-jost text-[10px] font-medium text-gold">{percent}%</span>
                </div>
                <div className="h-1 bg-cream/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {sections
                    .filter((s) => !s.done)
                    .map((s) => (
                      <span
                        key={s.label}
                        className="font-jost text-[9px] text-amber-400/80 bg-amber-400/10 rounded px-1.5 py-0.5"
                      >
                        {s.label}
                      </span>
                    ))}
                </div>
              </div>
            )}
            {profileData && allComplete && (
              <div className="mt-3 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-jost text-[10px] text-green-400/80">Profile complete</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-jost font-light transition-all duration-150
                    ${
                      isActive
                        ? 'bg-cream/10 text-cream'
                        : 'text-cream/50 hover:bg-cream/5 hover:text-cream/80'
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
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-jost font-light text-cream/35 hover:text-cream/60 hover:bg-cream/5 transition-all duration-150"
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
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
