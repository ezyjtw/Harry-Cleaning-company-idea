"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Close menu on route change (escape key)
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <header className="relative z-50 bg-white shadow-sm" ref={menuRef}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Rena home">
          <span className="text-xl font-extrabold uppercase tracking-wide text-brand-700">
            Rena
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:px-4"
          >
            Sign Up
          </Link>

          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-brand-700 touch-target sm:ml-1"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Full-width dropdown panel */}
      {menuOpen && (
        <nav
          className="animate-slide-down border-t border-gray-200 bg-white shadow-lg"
          aria-label="Main navigation"
        >
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            {/* Client flow */}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              I need a cleaner
            </h3>
            <div className="mt-2 flex flex-col gap-0.5">
              <Link
                href="/services"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Book a Clean
              </Link>
              <Link
                href="/cleaners"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Find Cleaners
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/faq"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                FAQ
              </Link>
            </div>

            {/* Cleaner flow */}
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              I&apos;m a cleaner
            </h3>
            <div className="mt-2 flex flex-col gap-0.5">
              <Link
                href="/join"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Become a Cleaner
              </Link>
              <Link
                href="/cleaner"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Cleaner Dashboard
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
