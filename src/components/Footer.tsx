import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-ink">
      {/* Link columns */}
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-8 md:px-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Customers */}
          <div>
            <h3 className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              For Customers
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/services', label: 'Book a Clean' },
                { href: '/cleaners', label: 'Find Cleaners' },
                { href: '/how-it-works', label: 'How It Works' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/faq', label: 'FAQ' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cleaners */}
          <div>
            <h3 className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              For Cleaners
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/join', label: 'Become a Cleaner' },
                { href: '/cleaner', label: 'Cleaner Dashboard' },
                { href: '/cleaner/earnings', label: 'Earnings' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/about', label: 'About Us' },
                { href: '/contact', label: 'Contact' },
                { href: '/company', label: 'Partner With Us' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms of Service' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row md:px-14">
          <Link
            href="/"
            className="font-cormorant text-[22px] font-semibold tracking-widest text-white"
          >
            RENA
          </Link>
          <span className="font-jost text-[12px] tracking-wide text-white/25">
            &copy; {new Date().getFullYear()} Rena
          </span>
        </div>
      </div>
    </footer>
  );
}
