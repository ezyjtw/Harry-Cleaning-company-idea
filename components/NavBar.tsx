'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="bg-white px-5 py-4 md:px-14 md:py-5"
      style={{ borderBottom: '1px solid rgba(27,42,74,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="font-cormorant text-[28px] font-semibold tracking-widest text-ink md:text-[34px]"
        >
          RENA
        </Link>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
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

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#how-it-works"
            className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
          >
            How it works
          </Link>
          <Link
            href="/services"
            className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
          >
            Services
          </Link>
          <Link
            href="/pricing"
            className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
          >
            Pricing
          </Link>
          <Link
            href="/join"
            className="font-jost text-[13px] font-normal text-ink-2 transition-colors hover:text-ink"
          >
            For cleaners
          </Link>
          <Link
            href="/book"
            className="rounded-md bg-gold px-6 py-2.5 font-jost text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Book a clean
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="mt-4 flex flex-col gap-4 pb-2 md:hidden">
          <Link
            href="#how-it-works"
            onClick={() => setOpen(false)}
            className="font-jost text-[15px] font-normal text-ink-2"
          >
            How it works
          </Link>
          <Link
            href="/services"
            onClick={() => setOpen(false)}
            className="font-jost text-[15px] font-normal text-ink-2"
          >
            Services
          </Link>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="font-jost text-[15px] font-normal text-ink-2"
          >
            Pricing
          </Link>
          <Link
            href="/join"
            onClick={() => setOpen(false)}
            className="font-jost text-[15px] font-normal text-ink-2"
          >
            For cleaners
          </Link>
          <Link
            href="/book"
            onClick={() => setOpen(false)}
            className="w-full rounded-md bg-gold py-3 text-center font-jost text-[14px] font-medium text-white"
          >
            Book a clean
          </Link>
        </div>
      )}
    </nav>
  );
}
