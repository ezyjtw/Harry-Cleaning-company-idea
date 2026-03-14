"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icons/rena-logo.png"
            alt="Rena logo"
            width={44}
            height={44}
            className="h-11 w-11"
            priority
          />
          <span className="text-2xl font-extrabold uppercase tracking-wide text-brand-700">
            Rena
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/services"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Book a Clean
          </Link>
          <Link
            href="/cleaners"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Find Cleaners
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            How It Works
          </Link>
          <Link
            href="/join"
            className="text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Become a Cleaner
          </Link>
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
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6 text-gray-700"
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

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="border-t border-gray-200 px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-3 pt-3">
            <Link
              href="/services"
              className="text-sm font-medium text-gray-600"
              onClick={() => setMenuOpen(false)}
            >
              Book a Clean
            </Link>
            <Link
              href="/cleaners"
              className="text-sm font-medium text-gray-600"
              onClick={() => setMenuOpen(false)}
            >
              Find Cleaners
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-gray-600"
              onClick={() => setMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="/join"
              className="text-sm font-medium text-gray-600"
              onClick={() => setMenuOpen(false)}
            >
              Become a Cleaner
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600"
              onClick={() => setMenuOpen(false)}
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white"
              onClick={() => setMenuOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
