'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, isAuthenticated, isLoading, isCleaner, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Nav');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header
      ref={menuRef}
      className="relative bg-white"
      style={{ borderBottom: '1px solid rgba(27,42,74,0.06)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-14 md:py-5">
        <Link
          href="/"
          className="font-etna text-[28px] font-semibold tracking-widest text-ink md:text-[34px]"
        >
          RENA
        </Link>

        <div className="flex items-center gap-3">
          {/* Hamburger icon */}
          <button
            onClick={() => setOpen(!open)}
            className="flex flex-col gap-1.5"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
          >
            <span
              className={`block h-[2px] w-6 rounded bg-ink transition-transform ${open ? 'translate-y-[5px] rotate-45' : ''}`}
            />
            <span
              className={`block h-[2px] w-6 rounded bg-ink transition-opacity ${open ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-[2px] w-6 rounded bg-ink transition-transform ${open ? '-translate-y-[5px] -rotate-45' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20" onClick={() => setOpen(false)} />
          <nav
            className="absolute right-4 top-[60px] z-50 w-[300px] max-h-[calc(100vh-80px)] overflow-y-auto rounded-xl bg-white shadow-xl md:right-14 md:top-[72px]"
            style={{ border: '1px solid rgba(27,42,74,0.08)' }}
            aria-label="Main navigation"
          >
            <div className="px-5 py-5">
              <p className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                {t('customerSection')}
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {[
                  { href: '/services', label: t('bookClean') },
                  { href: '/cleaners', label: t('findCleaners') },
                  { href: '/#how-it-works', label: t('howItWorks') },
                  { href: '/pricing', label: t('pricing') },
                  { href: '/faq', label: t('faq') },
                  { href: '/contact', label: t('contactUs') },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 font-jost text-[14px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {!isCleaner && (
                <>
                  <p className="mt-5 font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                    {t('cleanerSection')}
                  </p>
                  <div className="mt-3 flex flex-col gap-1">
                    <Link
                      href="/join"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2 font-jost text-[14px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                    >
                      {t('becomeCleaner')}
                    </Link>
                  </div>
                </>
              )}

              {isCleaner && (
                <>
                  <p className="mt-5 font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                    {t('myCleanerAccount')}
                  </p>
                  <div className="mt-3 flex flex-col gap-1">
                    {[
                      { href: '/cleaner', label: t('dashboard') },
                      { href: '/cleaner/jobs', label: t('myJobs') },
                      { href: '/cleaner/earnings', label: t('earnings') },
                      { href: '/cleaner/profile', label: t('profile') },
                    ].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="rounded-md px-3 py-2 font-jost text-[14px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {isAdmin && (
                <>
                  <p className="mt-5 font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                    {t('admin')}
                  </p>
                  <div className="mt-3 flex flex-col gap-1">
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2 font-jost text-[14px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                    >
                      {t('adminDashboard')}
                    </Link>
                  </div>
                </>
              )}

              <div className="mt-6 flex items-center gap-4 border-t border-ink/5 pt-5">
                {isLoading ? (
                  <div className="h-9 w-24 animate-pulse rounded-md bg-ink/5" />
                ) : isAuthenticated ? (
                  <>
                    <span className="font-jost text-[13px] font-normal text-ink-2">
                      {user?.name}
                    </span>
                    <button
                      onClick={() => {
                        setOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className="rounded-md bg-ink px-5 py-2.5 font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
                    >
                      {t('signOut')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
                    >
                      {t('logIn')}
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className="rounded-md bg-ink px-5 py-2.5 font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
                    >
                      {t('signUp')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
