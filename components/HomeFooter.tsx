import Link from 'next/link';

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
    <footer className="flex items-center justify-between bg-ink px-14 py-9">
      <Link href="/" className="font-cormorant text-[20px] font-light tracking-widest text-cream">
        RENA
      </Link>
      <div className="flex gap-7">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="font-jost text-[12px] font-light tracking-wide text-white/35"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="font-jost text-[12px] font-light tracking-wide text-white/25">
        © 2026 Rena
      </span>
    </footer>
  );
}
