import Link from 'next/link';

import { FooterPaymentMethods, FooterSocialLinks } from '../src/components/FooterShared';

const links = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'For cleaners', href: '/join' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function HomeFooter() {
  return (
    <footer className="bg-ink px-5 py-8 md:px-14 md:py-9">
      <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
        <Link href="/" className="font-etna text-[22px] font-semibold tracking-widest text-white">
          RENA
        </Link>
        <div className="flex flex-wrap justify-center gap-4 md:gap-7">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-jost text-[12px] tracking-wide text-white/50 transition-colors hover:text-white/80"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <FooterSocialLinks />
      </div>
      <FooterPaymentMethods />
    </footer>
  );
}
