'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      className="bg-white"
      style={{ borderBottom: '1px solid rgba(27,42,74,0.06)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-14 md:py-5">
        <Link
          href="/"
          className="font-cormorant text-[28px] font-semibold tracking-widest text-ink md:text-[34px]"
        >
          RENA
        </Link>

        {/* Hamburger icon */}
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5"
          aria-label={open ? 'Close menu' : 'Open menu'}
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

      {/* Side panel — full-width on mobile, left-anchored sidebar on desktop */}
      {open && (
        <>
          {/* Backdrop — desktop only */}
          <div
            className="hidden md:block fixed inset-0 z-40 bg-ink/20"
            onClick={() => setOpen(false)}
          />
          <nav
            className="border-t border-ink/5 bg-white md:fixed md:left-0 md:top-0 md:z-50 md:h-full md:w-[320px] md:border-t-0 md:border-r md:border-ink/10 md:shadow-lg md:overflow-y-auto"
            aria-label="Main navigation"
          >
            {/* Close button — desktop sidebar */}
            <div className="hidden md:flex items-center justify-between px-6 py-5 border-b border-ink/5">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="font-cormorant text-[28px] font-semibold tracking-widest text-ink"
              >
                RENA
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-ink-3 hover:text-ink transition-colors"
                aria-label="Close menu"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-6 md:px-6">
              {/* Client flow */}
              <p className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                I need a cleaner
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {[
                  { href: '/services', label: 'Book a Clean' },
                  { href: '/cleaners', label: 'Find Cleaners' },
                  { href: '/#how-it-works', label: 'How It Works' },
                  { href: '/pricing', label: 'Pricing' },
                  { href: '/faq', label: 'FAQ' },
                  { href: '/contact', label: 'Contact Us' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 font-jost text-[15px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Cleaner flow */}
              <p className="mt-6 font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                I&apos;m a cleaner
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {[
                  { href: '/join', label: 'Become a Cleaner' },
                  { href: '/cleaner', label: 'Cleaner Dashboard' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 font-jost text-[15px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Partner flow */}
              <p className="mt-6 font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-ink-3">
                Partner with us
              </p>
              <div className="mt-3 flex flex-col gap-1">
                <Link
                  href="/company"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 font-jost text-[15px] font-normal text-ink-2 transition-colors hover:bg-cream hover:text-ink"
                >
                  Partner Dashboard
                </Link>
              </div>

              {/* Auth links */}
              <div className="mt-8 flex items-center gap-4">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-ink px-5 py-2.5 font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
