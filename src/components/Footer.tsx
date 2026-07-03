'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { FooterPaymentMethods, FooterSocialLinks } from './FooterShared';

export default function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer className="bg-ink">
      {/* Link columns */}
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-8 md:px-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Customers */}
          <div>
            <h3 className="font-jost text-[11px] font-medium uppercase tracking-[0.15em] text-white/70">
              {t('forCustomers')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/services', label: t('bookClean') },
                { href: '/cleaners', label: t('findCleaners') },
                { href: '/how-it-works', label: t('howItWorks') },
                { href: '/pricing', label: t('pricing') },
                { href: '/faq', label: t('faq') },
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
              {t('forCleaners')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/join', label: t('becomeCleaner') },
                { href: '/cleaner', label: t('cleanerDashboard') },
                { href: '/cleaner/earnings', label: t('earnings') },
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
              {t('company')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/about', label: t('aboutUs') },
                { href: '/contact', label: t('contact') },
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
              {t('legal')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/privacy', label: t('privacyPolicy') },
                { href: '/terms', label: t('termsOfService') },
                { href: '#cookie-settings', label: t('cookieSettings') },
              ].map((link) => (
                <li key={link.href}>
                  {link.href === '#cookie-settings' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.openCookieSettings) window.openCookieSettings();
                      }}
                      className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-jost text-[13px] font-light text-white/50 transition-colors hover:text-white/80"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-14">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link
              href="/"
              className="font-etna text-[22px] font-semibold tracking-widest text-white"
            >
              RENA
            </Link>
            <FooterSocialLinks />
            <span className="font-jost text-[12px] tracking-wide text-white/25">
              &copy; {new Date().getFullYear()} Rena
            </span>
          </div>
          <FooterPaymentMethods />
        </div>
      </div>
    </footer>
  );
}
