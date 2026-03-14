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

  return (
    <header className="relative z-50 bg-white shadow-sm" ref={menuRef}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold uppercase tracking-wide text-brand-700">
            Rena
          </span>
        </Link>

        {/* Right side: Login/Signup + menu toggle */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Sign Up
          </Link>

          {/* Menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-brand-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
        <nav className="border-t border-gray-200 bg-white shadow-lg">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {/* Client flow */}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              I need a cleaner
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              <Link
                href="/services"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Book a Clean
              </Link>
              <Link
                href="/cleaners"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Find Cleaners
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                How It Works
              </Link>
            </div>

            {/* Cleaner flow */}
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
              I&apos;m a cleaner
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              <Link
                href="/join"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMenuOpen(false)}
              >
                Become a Cleaner
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
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
